import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  applyCommand,
  emptyOperations,
  permitted,
  loadCatalogs,
  loadWorkbench,
  loadTripCases,
  saveVehicle,
  saveProduct,
  saveService,
  availableStock,
  fleetRecords,
  vehicleIncidents,
  type AuthUser,
  type OperationsState,
} from '@real-ejecutivo/domain';
import { ZodError, z } from 'zod';
import { PrismaService } from '../database/prisma.service';
import { parseEnvelope } from './command-schema';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async initialize() {
    const state = emptyOperations();
    // Unidades ya registradas en la API anterior también se conservan.
    const buses = await this.prisma.bus.findMany({ where: { isActive: true } });
    state.catalogs.vehicles = buses.map((b) => ({
      id: b.id,
      fleetNumber: b.fleetNumber,
      type: b.vehicleType === 'BUS' ? 'bus' : 'truck',
      brand: b.brand ?? '',
      model: b.model ?? '',
      plate: b.licensePlate ?? '',
      vin: b.vin ?? '',
      year: b.modelYear,
      odometer: b.odometerKm,
      note: b.notes,
    }));
    return this.prisma.operationState.upsert({
      where: { id: 1 },
      create: { id: 1, data: json(state) },
      update: {},
    });
  }

  async snapshot(user: AuthUser) {
    const row = await this.initialize();
    const state = structuredClone(row.data) as unknown as OperationsState;
    if (user.role === 'DRIVER') {
      state.catalogs.products = [];
      state.catalogs.services = [];
      state.workbench = {
        orders: [],
        requests: state.workbench.requests
          .filter((r) => r.driverId === user.id)
          .map((r) =>
            r.status === 'converted'
              ? {
                  ...r,
                  orderNumber: state.workbench.orders.find(
                    (o) => o.id === r.orderId,
                  )?.number,
                }
              : r,
          ),
      };
      state.trips = state.trips.filter((t) => t.driverId === user.id);
    } else if (user.role === 'WAREHOUSE_CLERK') {
      state.workbench = { orders: state.workbench.orders, requests: [] };
      state.catalogs.reviews = [];
      state.trips = [];
    } else if (user.role === 'TECHNICIAN')
      throw new ForbiddenException('Módulo no disponible para este perfil.');
    const draft = await this.prisma.operationDraft.findUnique({
      where: { userId: user.id },
    });
    return {
      ...state,
      revision: row.revision,
      imported: row.imported,
      draft: draft?.form ?? null,
    };
  }

  async execute(user: AuthUser, body: unknown) {
    let envelope: ReturnType<typeof parseEnvelope>;
    try {
      envelope = parseEnvelope(body);
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException(
          'Formato o campos de la operación no válidos.',
        );
      throw error;
    }
    if (!permitted(user, envelope.command.type))
      throw new ForbiddenException(
        'Tu perfil no puede realizar esta operación.',
      );
    await this.initialize();
    const hash = digest(envelope.command);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Bloqueo global del agregado: stock, órdenes y solicitudes cambian juntos.
          await tx.$queryRaw`SELECT "id" FROM "OperationState" WHERE "id" = 1 FOR UPDATE`;
          const replay = await tx.operationEvent.findUnique({
            where: { id: envelope.commandId },
          });
          if (replay) {
            if (replay.userId !== user.id || replay.digest !== hash)
              throw new ConflictException(
                'Identificador de operación reutilizado con otros datos.',
              );
            return;
          }
          const row = await tx.operationState.findUniqueOrThrow({
            where: { id: 1 },
          });
          if (row.revision !== envelope.revision)
            throw new ConflictException(
              'Hay cambios de otro usuario. Recarga los datos antes de volver a guardar. Tu formulario no se ha borrado.',
            );
          let next: OperationsState;
          try {
            next = applyCommand(
              row.data as unknown as OperationsState,
              user,
              envelope.command,
              row.revision + 1,
            );
          } catch (error) {
            throw new BadRequestException(
              error instanceof Error
                ? error.message
                : 'La operación no es válida.',
            );
          }
          if (envelope.command.type === 'draft.save') {
            const form = json(envelope.command.form);
            await tx.operationDraft.upsert({
              where: { userId: user.id },
              create: { userId: user.id, form },
              update: { form },
            });
          }
          await tx.operationState.update({
            where: { id: 1 },
            data: { data: json(next), revision: { increment: 1 } },
          });
          await tx.operationEvent.create({
            data: {
              id: envelope.commandId,
              userId: user.id,
              type: envelope.command.type,
              revision: row.revision + 1,
              digest: hash,
              payload: json(envelope.command),
            },
          });
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'La operación entró en conflicto. Recarga antes de volver a intentar.',
        );
      throw error;
    }
    return this.snapshot(user);
  }

  async importLegacy(user: AuthUser, body: unknown) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Solo admin importa datos históricos.');
    const parsed = z
      .object({
        confirmed: z.literal(true),
        commandId: z.string().uuid(),
        revision: z.number().int().nonnegative(),
        catalogs: z
          .object({
            version: z.literal(1),
            vehicles: z.array(z.unknown()).max(5000),
            products: z.array(z.unknown()).max(5000),
            services: z.array(z.unknown()).max(5000),
            reviews: z.array(z.unknown()).max(5000),
          })
          .strict(),
        workbench: z
          .object({
            orders: z.array(z.unknown()).max(10000),
            requests: z.array(z.unknown()).max(10000),
            fleet: z.unknown().optional(),
          })
          .strict(),
        trips: z.array(z.unknown()).max(10000),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Confirma y revisa el archivo de importación.',
      );
    const input = parsed.data;
    let state: OperationsState;
    try {
      state = {
        catalogs: loadCatalogs(JSON.stringify(input.catalogs)),
        workbench: loadWorkbench(JSON.stringify(input.workbench)),
        trips: loadTripCases(JSON.stringify(input.trips)),
      };
      this.checkReferences(state);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Archivo incompatible.',
      );
    }
    await this.initialize();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OperationState" WHERE "id" = 1 FOR UPDATE`;
      const row = await tx.operationState.findUniqueOrThrow({
        where: { id: 1 },
      });
      const before = row.data as unknown as OperationsState;
      if (
        row.revision !== input.revision ||
        row.imported ||
        row.revision !== 0 ||
        before.catalogs.vehicles.length
      )
        throw new ConflictException(
          'La base ya contiene operaciones o unidades. No se reemplazaron los datos: requiere conciliación revisada.',
        );
      await tx.operationState.update({
        where: { id: 1 },
        data: { data: json(state), imported: true, revision: { increment: 1 } },
      });
      await tx.operationEvent.create({
        data: {
          id: input.commandId,
          userId: user.id,
          type: 'legacy.import',
          revision: 1,
          digest: digest(state),
          payload: json({
            source: 'browser-export',
            counts: {
              vehicles: state.catalogs.vehicles.length,
              orders: state.workbench.orders.length,
              requests: state.workbench.requests.length,
              trips: state.trips.length,
            },
            historicActorsUnverified: true,
          }),
        },
      });
    });
    return this.snapshot(user);
  }

  private checkReferences(state: OperationsState) {
    const normalized = (value: string) => value.trim().toUpperCase();
    const unique = (values: string[]) => {
      if (new Set(values.map(normalized)).size !== values.length)
        throw new Error('Hay claves o nombres duplicados en los catálogos.');
    };
    unique(state.catalogs.vehicles.map((v) => v.fleetNumber));
    unique(state.catalogs.vehicles.map((v) => v.plate).filter(Boolean));
    unique(state.catalogs.vehicles.map((v) => v.vin).filter(Boolean));
    unique(state.catalogs.products.map((p) => p.sku));
    unique(state.catalogs.services.map((s) => s.name));
    unique(state.catalogs.reviews.map((r) => r.name));
    for (const v of state.catalogs.vehicles)
      saveVehicle(state.catalogs, v, v.id);
    for (const p of state.catalogs.products) {
      saveProduct(
        state.catalogs,
        p,
        {
          quantity: 0,
          unitCost: p.cost,
          occurredOn: '',
          supplier: '',
          receiptReference: '',
        },
        p.id,
      );
      if (availableStock(p, state.workbench.orders) < -1e-6)
        throw new Error(
          'El respaldo contiene existencias negativas. Requiere conciliación.',
        );
    }
    for (const s of state.catalogs.services)
      saveService(state.catalogs, s, s.id);
    const ids = (items: { id: string }[]) => {
      if (new Set(items.map((i) => i.id)).size !== items.length)
        throw new Error('Hay identificadores duplicados.');
      return new Set(items.map((i) => i.id));
    };
    const vehicles = ids(state.catalogs.vehicles);
    const products = ids(state.catalogs.products);
    const fleet = fleetRecords(state.workbench);
    for (const list of [
      fleet.reviewJobs,
      fleet.damages,
      fleet.resolutions,
      fleet.cafCorrections,
    ]) {
      ids(list);
      if (list.some((item) => !vehicles.has(item.busId)))
        throw new Error('El expediente contiene una unidad inexistente.');
    }
    const incidentIds = new Set(
      state.catalogs.vehicles.flatMap((v) =>
        vehicleIncidents(v.id, state.workbench, state.trips).map(
          (i) => i.sourceId,
        ),
      ),
    );
    if (
      fleet.resolutions.some(
        (r) =>
          !incidentIds.has(r.sourceId) ||
          (r.orderId &&
            !state.workbench.orders.some(
              (o) =>
                o.id === r.orderId &&
                o.form.busId === r.busId &&
                o.status === 'Finalizada',
            )),
      )
    )
      throw new Error(
        'Hay reparaciones sin una incidencia u orden compatible.',
      );
    ids(state.catalogs.services);
    ids(state.catalogs.reviews);
    ids(state.workbench.requests);
    ids(state.workbench.orders);
    ids(state.trips);
    for (const record of [
      ...state.workbench.requests,
      ...state.trips,
      ...state.workbench.orders.map((o) => ({ busId: o.form.busId })),
    ])
      if (!vehicles.has(record.busId))
        throw new Error('Hay registros de una unidad inexistente.');
    for (const order of state.workbench.orders)
      for (const service of order.form.services)
        for (const m of service.materials)
          if (!products.has(m.productId))
            throw new Error('Hay órdenes con artículos inexistentes.');
    for (const request of state.workbench.requests)
      if (
        request.status === 'converted' &&
        !state.workbench.orders.some(
          (o) =>
            o.id === request.orderId && o.form.sourceRequestId === request.id,
        )
      )
        throw new Error('El vínculo solicitud/orden es incompatible.');
  }
}
