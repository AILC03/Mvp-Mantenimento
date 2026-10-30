import {
  applyCommand,
  defaultCatalogs,
  dateToday,
  externalTotal,
  latestCirculation,
  loadWorkbench,
  vehicleTypeLabel,
  type AuthUser,
  type OperationsState,
  type ExternalServiceInput,
  type SavedOrder,
} from '@real-ejecutivo/domain';
import { OperationsService } from './operations.service';
import type { PrismaService } from '../database/prisma.service';

const admin: AuthUser = {
  id: 'admin',
  username: 'admin',
  name: 'Admin',
  role: 'ADMIN',
};
const mechanic: AuthUser = { ...admin, id: 'mechanic', role: 'LEAD_MECHANIC' };
const input: ExternalServiceInput = {
  kind: 'roadside',
  date: dateToday(),
  description: 'Reparación de carretera',
  provider: 'Prestador',
  materialsCost: 0.1,
  laborCost: 0.2,
  notes: '',
};
const initial = (): OperationsState => ({
  catalogs: defaultCatalogs(),
  workbench: { orders: [], requests: [] },
  trips: [],
});

describe('Ampliaciones acotadas de unidades en JSONB', () => {
  it('TRUCK heredado se proyecta como truck/Sprinter sin cambiar ID ni sobrescribir JSONB existente', async () => {
    const row = {
      id: 'legacy-id',
      fleetNumber: 'SPR-LEGACY',
      vehicleType: 'TRUCK',
      brand: 'Mercedes',
      model: 'Sprinter',
      licensePlate: 'SPR',
      vin: null,
      modelYear: 2020,
      odometerKm: 5000,
      notes: 'Histórico',
    };
    type Upsert = { create: { data: OperationsState }; update: object };
    const prisma = {
      bus: { findMany: jest.fn().mockResolvedValue([row]) },
      operationState: {
        upsert: jest
          .fn<Promise<{ id: number }>, [Upsert]>()
          .mockResolvedValue({ id: 1 }),
      },
    };
    await new OperationsService(
      prisma as unknown as PrismaService,
    ).initialize();
    const upsert = prisma.operationState.upsert.mock.calls[0][0];
    expect(upsert.create.data.catalogs.vehicles[0]).toMatchObject({
      id: row.id,
      type: 'truck',
      fleetNumber: row.fleetNumber,
      note: row.notes,
    });
    expect(vehicleTypeLabel(upsert.create.data.catalogs.vehicles[0].type)).toBe(
      'Sprinter',
    );
    expect(upsert.update).toEqual({});
  });
  it('conserva snapshots antiguos, permite costos cero y deriva el total en centavos', () => {
    const state = initial(),
      id = state.catalogs.vehicles[0].id;
    expect(latestCirculation(state.workbench, id)).toBeUndefined();
    expect(loadWorkbench(JSON.stringify(state.workbench))).toEqual(
      state.workbench,
    );
    const next = applyCommand(
      state,
      mechanic,
      { type: 'external.record', vehicleId: id, input },
      1,
    );
    expect(externalTotal(next.workbench.externalServices![0])).toBe(0.3);
    expect(next.catalogs).toEqual(state.catalogs);
    expect(next.workbench.orders).toEqual(state.workbench.orders);
    expect(next.workbench.externalServices![0]).toMatchObject({
      actorId: mechanic.id,
      busId: id,
    });
    const zero = applyCommand(
      next,
      admin,
      {
        type: 'external.record',
        vehicleId: id,
        input: { ...input, materialsCost: 0, laborCost: 0 },
      },
      2,
    );
    expect(loadWorkbench(JSON.stringify(zero.workbench))).toEqual(
      zero.workbench,
    );
    expect(state.workbench.externalServices).toBeUndefined();
  });
  it.each([
    { materialsCost: -1 },
    { laborCost: 1.001 },
    { date: '2026-02-30' },
    { date: '2999-01-01' },
    { description: ' ' },
    { provider: ' ' },
  ])('rechaza registro externo inválido %j', (change) => {
    const state = initial();
    expect(() =>
      applyCommand(
        state,
        admin,
        {
          type: 'external.record',
          vehicleId: state.catalogs.vehicles[0].id,
          input: { ...input, ...change },
        },
        1,
      ),
    ).toThrow();
  });
  it.each(['DRIVER', 'WAREHOUSE_CLERK', 'TECHNICIAN'] as const)(
    'rechaza mutaciones del perfil %s',
    (role) => {
      const state = initial(),
        user = { ...admin, role },
        vehicleId = state.catalogs.vehicles[0].id;
      expect(() =>
        applyCommand(
          state,
          user,
          { type: 'external.record', vehicleId, input },
          1,
        ),
      ).toThrow();
      expect(() =>
        applyCommand(
          state,
          user,
          { type: 'circulation.decide', vehicleId, status: 'authorized' },
          1,
        ),
      ).toThrow();
    },
  );
  it('exige unidad existente y conserva historial autorizado → no autorizado → sin evaluar', () => {
    let state = initial();
    const vehicleId = state.catalogs.vehicles[0].id;
    expect(() =>
      applyCommand(
        state,
        admin,
        { type: 'external.record', vehicleId: 'missing', input },
        1,
      ),
    ).toThrow('unidad');
    expect(() =>
      applyCommand(
        state,
        admin,
        {
          type: 'circulation.decide',
          vehicleId: 'missing',
          status: 'authorized',
        },
        1,
      ),
    ).toThrow('unidad');
    for (const status of ['authorized', 'unauthorized', 'unevaluated'] as const)
      state = applyCommand(
        state,
        mechanic,
        { type: 'circulation.decide', vehicleId, status },
        1,
      );
    expect(state.workbench.circulationDecisions!.map((d) => d.status)).toEqual([
      'unevaluated',
      'unauthorized',
      'authorized',
    ]);
    expect(latestCirculation(state.workbench, vehicleId)?.status).toBe(
      'unevaluated',
    );
    expect(loadWorkbench(JSON.stringify(state.workbench))).toEqual(
      state.workbench,
    );
  });
  it('valida cierre contra apertura propia, no contra lecturas posteriores, y no reescribe el pasado', () => {
    const state = initial(),
      vehicleId = state.catalogs.vehicles[0].id;
    const order: SavedOrder = {
      id: 'order',
      number: 'OT1',
      createdAt: '2026-01-01T00:00:00Z',
      status: 'En proceso',
      form: {
        busId: vehicleId,
        priority: 'Normal',
        reason: '',
        scheduledDate: '',
        odometer: '1000',
        services: [
          {
            id: 's',
            catalogId: 'oil-change',
            name: 'CAF',
            category: '',
            hours: 1,
            instructions: '',
            assignee: '',
            materials: [],
          },
        ],
      },
    };
    const historical = {
      ...order,
      id: 'historical',
      status: 'Finalizada' as const,
      completion: {
        date: '2026-01-02',
        odometer: 1,
        performedServiceIds: ['s'],
        unperformedReasons: {},
        notes: '',
        actorId: 'old',
        actorName: 'Old',
        recordedAt: '2026-01-03T00:00:00Z',
      },
    };
    state.workbench.orders = [order, historical];
    state.catalogs.vehicles[0].odometer = 999999;
    const command = {
      type: 'order.finish' as const,
      id: order.id,
      input: {
        date: '2026-01-04',
        odometer: 1,
        performedServiceIds: ['s'],
        unperformedReasons: {},
        notes: '',
      },
    };
    expect(() => applyCommand(state, mechanic, command, 1)).toThrow('apertura');
    const next = applyCommand(
      state,
      mechanic,
      { ...command, input: { ...command.input, odometer: 1000 } },
      1,
    );
    expect(next.workbench.orders[0].completion?.odometer).toBe(1000);
    expect(next.workbench.orders[1]).toEqual(historical);
    expect(loadWorkbench(JSON.stringify(next.workbench)).orders[1]).toEqual(
      historical,
    );
  });
});
