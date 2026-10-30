import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  defaultCatalogs,
  dateToday,
  emptyForm,
  availableStock,
  externalTotal,
  type Command,
  type OperationsState,
  type OrderForm,
} from '@real-ejecutivo/domain';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { hashPassword } from '../src/auth/password';

type Snapshot = OperationsState & { revision: number; draft: OrderForm | null };
const databaseTests =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
databaseTests('Operación completa con PostgreSQL aislado', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let revision = 0;
  const origin = 'http://127.0.0.1:5173';
  const cookies: Record<string, string> = {};
  const actorIds: Record<string, string> = {};
  const vehicleId = randomUUID(),
    sprinterId = randomUUID(),
    productId = randomUUID(),
    requestId = randomUUID(),
    orderId = randomUUID(),
    tripId = randomUUID();
  const form: OrderForm = {
    ...emptyForm(),
    busId: vehicleId,
    sourceRequestId: requestId,
    odometer: '1000',
    services: [
      {
        id: 'service-1',
        catalogId: 'oil-change',
        name: 'CAF',
        category: 'Motor',
        hours: 2,
        assignee: '',
        instructions: '',
        materials: [
          { id: 'material-1', productId, quantity: 5, unitCost: 9999 },
        ],
      },
    ],
  };

  beforeAll(async () => {
    if (
      !/\/real_ejecutivo_test_[a-f0-9]+(?:\?|$)/.test(
        process.env.DATABASE_URL ?? '',
      )
    )
      throw new Error(
        'Estas pruebas requieren la BD temporal creada por npm run test:database. No se usará la base operativa.',
      );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['mechanic', 'LEAD_MECHANIC'],
      ['warehouse', 'WAREHOUSE_CLERK'],
      ['driver', 'DRIVER'],
      ['other', 'DRIVER'],
      ['technician', 'TECHNICIAN'],
    ] as const) {
      const username = `ops-${key}`;
      const user = await prisma.user.create({
        data: {
          username,
          name: `Prueba ${key}`,
          role,
          passwordHash: await hashPassword('Test-Operations-123'),
        },
      });
      actorIds[key] = user.id;
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ username, password: 'Test-Operations-123' })
        .expect(200);
      cookies[key] = (
        login.headers['set-cookie'] as unknown as string[]
      )[0].split(';')[0];
    }
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });
  const api = () => request(app.getHttpServer());
  async function latest(user = 'admin') {
    const response = await api()
      .get('/api/operations')
      .set('Cookie', cookies[user])
      .expect(200);
    const state = response.body as Snapshot;
    revision = state.revision;
    return state;
  }
  async function command(user: string, value: Command, status = 201) {
    const envelope = { revision, commandId: randomUUID(), command: value };
    const response = await api()
      .post('/api/operations/commands')
      .set('Cookie', cookies[user])
      .set('Origin', origin)
      .send(envelope)
      .expect(status);
    if (status === 201) revision = (response.body as Snapshot).revision;
    return { envelope, state: response.body as Snapshot };
  }

  it('exige sesión, origen, esquema estricto y permisos reales', async () => {
    await api().get('/api/operations').expect(401);
    await latest();
    const c: Command = { type: 'draft.save', form: emptyForm() };
    await api()
      .post('/api/operations/commands')
      .set('Cookie', cookies.admin)
      .send({ commandId: randomUUID(), revision, command: c })
      .expect(403);
    await api()
      .post('/api/operations/commands')
      .set('Cookie', cookies.admin)
      .set('Origin', origin)
      .send({
        commandId: randomUUID(),
        revision,
        command: { ...c, actorId: 'forged' },
      })
      .expect(400);
    await command('driver', c, 403);
    await command(
      'warehouse',
      {
        type: 'vehicle.save',
        input: {
          fleetNumber: 'V',
          type: 'bus',
          brand: '',
          model: '',
          plate: '',
          vin: '',
          year: null,
          odometer: 0,
          note: '',
        },
        clientId: randomUUID(),
      },
      403,
    );
  });

  it('importa solo con confirmación de admin y conserva IDs sin atribuir actores demo', async () => {
    const catalogs = defaultCatalogs();
    catalogs.vehicles.push({
      ...catalogs.vehicles[0],
      id: sprinterId,
      fleetNumber: 'SPR-EXISTENTE',
      type: 'truck',
      plate: '',
      vin: '',
      odometer: 1000,
    });
    const legacy = {
      catalogs,
      workbench: {
        fleet: {
          reviewJobs: [],
          resolutions: [],
          cafCorrections: [],
          damages: [
            {
              id: 'sprinter-old-damage',
              busId: sprinterId,
              kind: 'Golpe',
              area: 'Puerta Sprinter',
              description: 'Historial anterior conservado',
              date: '2026-01-01',
              recordedAt: '2026-01-02T00:00:00Z',
              actorId: 'historic',
              actorName: 'Histórico',
            },
          ],
        },
        orders: [],
        requests: [
          {
            id: 'legacy-request',
            number: 'SOL-OLD',
            busId: catalogs.vehicles[0].id,
            title: 'Histórico',
            description: 'Origen no verificado',
            odometer: '',
            driverId: 'driver-demo',
            driverName: 'Demo',
            createdAt: new Date().toISOString(),
            status: 'pending',
          },
        ],
      },
      trips: [],
    };
    const body = {
      ...legacy,
      confirmed: true,
      commandId: randomUUID(),
      revision,
    };
    await api()
      .post('/api/operations/import')
      .set('Cookie', cookies.driver)
      .set('Origin', origin)
      .send(body)
      .expect(403);
    await api()
      .post('/api/operations/import')
      .set('Cookie', cookies.admin)
      .set('Origin', origin)
      .send({ ...body, confirmed: false })
      .expect(400);
    await api()
      .post('/api/operations/import')
      .set('Cookie', cookies.admin)
      .set('Origin', origin)
      .send(body)
      .expect(201);
    const state = await latest();
    expect(state.workbench.requests[0].driverId).toBe('driver-demo');
    expect(state.catalogs.vehicles[0].id).toBe(catalogs.vehicles[0].id);
    expect((await latest('driver')).workbench.requests).toHaveLength(0);
    await api()
      .post('/api/operations/import')
      .set('Cookie', cookies.admin)
      .set('Origin', origin)
      .send({ ...body, revision })
      .expect(409);
  });

  it('persiste catálogos, costos históricos y borradores privados; bloquea ediciones ajenas', async () => {
    await command('admin', {
      type: 'vehicle.save',
      clientId: vehicleId,
      input: {
        fleetNumber: 'OPS-BUS',
        type: 'bus',
        brand: 'Prueba',
        model: 'Modelo',
        plate: '',
        vin: '',
        year: 2025,
        odometer: 1000,
        note: '',
      },
    });
    await command('warehouse', {
      type: 'product.save',
      clientId: productId,
      input: { sku: 'OPS-OIL', name: 'Aceite API', description: '', unit: 'L' },
      initial: {
        quantity: 10,
        unitCost: 100,
        occurredOn: dateToday(),
        supplier: '',
        receiptReference: '',
      },
    });
    await command('mechanic', {
      type: 'service.save',
      id: 'oil-change',
      clientId: 'oil-change',
      input: {
        name: 'CAF',
        category: 'Motor',
        description: '',
        hours: 2,
        compatibleVehicleIds: [vehicleId],
        materials: [{ productId, quantity: 5 }],
      },
    });
    const state = await latest();
    expect(
      state.catalogs.products.find((p) => p.id === productId)?.entries[0],
    ).toMatchObject({ quantity: 10, unitCost: 100 });
    await command(
      'mechanic',
      {
        type: 'vehicle.save',
        id: vehicleId,
        clientId: vehicleId,
        input: {
          fleetNumber: 'OPS-BUS',
          type: 'bus',
          brand: 'Prueba',
          model: 'Modelo',
          plate: '',
          vin: '',
          year: 2025,
          odometer: 1000,
          note: '',
        },
      },
      403,
    );
    await command('mechanic', { type: 'draft.save', form });
    expect((await latest('mechanic')).draft?.busId).toBe(vehicleId);
    expect((await latest('admin')).draft).toBeNull();
  });

  it('comparte solicitudes entre dispositivos sin filtrar datos ajenos al chofer', async () => {
    await command('driver', {
      type: 'request.create',
      clientId: requestId,
      input: {
        busId: vehicleId,
        title: 'Revisión',
        description: 'Solicito revisión',
        odometer: '1000',
      },
    });
    const state = await latest('mechanic');
    expect(
      state.workbench.requests.find((r) => r.id === requestId)?.driverId,
    ).toBe(actorIds.driver);
    const other = await latest('other');
    expect(other.workbench.requests).toHaveLength(0);
    expect(other.catalogs.products).toHaveLength(0);
    expect(other.workbench.orders).toHaveLength(0);
    await command('mechanic', {
      type: 'order.create',
      clientId: orderId,
      form,
    });
    const order = (await latest()).workbench.orders.find(
      (o) => o.id === orderId,
    )!;
    expect(order.createdBy?.id).toBe(actorIds.mechanic);
    expect(order.form.services[0].materials[0].unitCost).toBe(100);
    expect(
      (await latest('driver')).workbench.requests.find(
        (r) => r.id === requestId,
      ),
    ).toMatchObject({ status: 'converted', orderId });
    await command(
      'mechanic',
      { type: 'request.reject', id: requestId, reason: 'Intento duplicado' },
      400,
    );
  });

  it('no finaliza sin entrega; registra materiales una sola vez e inicia nuevo CAF', async () => {
    await command('mechanic', {
      type: 'order.change',
      id: orderId,
      action: 'start',
      notes: '',
    });
    const finish: Command = {
      type: 'order.finish',
      id: orderId,
      input: {
        date: dateToday(),
        odometer: 1100,
        performedServiceIds: ['service-1'],
        unperformedReasons: {},
        notes: 'Trabajo completo',
      },
    };
    await command('mechanic', finish, 400);
    const saved = await command('warehouse', {
      type: 'materials.confirm',
      id: orderId,
      totals: [{ productId, delivered: 5, returned: 0 }],
      notes: 'Entregado',
    });
    await api()
      .post('/api/operations/commands')
      .set('Cookie', cookies.warehouse)
      .set('Origin', origin)
      .send(saved.envelope)
      .expect(201);
    const state = await latest();
    const order = state.workbench.orders.find((o) => o.id === orderId)!;
    expect(order.materialConfirmations).toHaveLength(1);
    expect(
      availableStock(
        state.catalogs.products.find((p) => p.id === productId)!,
        state.workbench.orders,
      ),
    ).toBe(5);
    await command('mechanic', finish);
    await command(
      'mechanic',
      {
        type: 'caf.correct',
        vehicleId,
        input: {
          date: dateToday(),
          odometer: 1090,
          reason: 'Corrección extraordinaria',
          confirmed: true,
        },
      },
      403,
    );
    await command('admin', {
      type: 'caf.correct',
      vehicleId,
      input: {
        date: dateToday(),
        odometer: 1090,
        reason: 'Corrección extraordinaria',
        confirmed: true,
      },
    });
    expect((await latest()).workbench.fleet?.cafCorrections[0]).toMatchObject({
      before: { odometer: 1100 },
      after: { odometer: 1090 },
      actorId: actorIds.admin,
    });
  });

  it('valida revisiones, daños y reparaciones en el servidor', async () => {
    await command('admin', {
      type: 'review.save',
      id: 'general',
      clientId: 'general',
      input: {
        name: 'General',
        description: '',
        frequency: 'days',
        intervalDays: 45,
        aspects: [{ id: 'a1', text: 'Frenos' }],
      },
    });
    await command('mechanic', {
      type: 'review.record',
      vehicleId,
      templateId: 'general',
      input: { date: dateToday(), answers: { a1: 'good' }, notes: '' },
    });
    await command('mechanic', {
      type: 'damage.add',
      vehicleId,
      input: {
        kind: 'Golpe',
        area: 'Puerta',
        description: 'Golpe de prueba',
        date: dateToday(),
      },
    });
    const state = await latest();
    const damage = state.workbench.fleet!.damages[0];
    await command('mechanic', {
      type: 'incident.resolve',
      vehicleId,
      sourceId: `damage:${damage.id}`,
      notes: 'Reparado',
      orderId: '',
    });
    expect((await latest()).workbench.fleet?.resolutions).toHaveLength(1);
  });

  it('valida pre/post y cierre único, conservando la versión de plantilla', async () => {
    await command('admin', {
      type: 'review.save',
      id: 'trip',
      clientId: 'trip',
      input: {
        name: 'Viaje',
        description: '',
        frequency: 'trip',
        intervalDays: null,
        aspects: [{ id: 't1', text: 'Salida de emergencia' }],
      },
    });
    await command('driver', {
      type: 'trip.start',
      clientId: tripId,
      input: {
        busId: vehicleId,
        departureDate: dateToday(),
        returnDate: dateToday(),
      },
    });
    await command(
      'driver',
      {
        type: 'trip.submit',
        id: tripId,
        stage: 'post',
        answers: { t1: 'good' },
        notes: '',
        templateId: 'trip',
      },
      400,
    );
    await command(
      'other',
      {
        type: 'trip.submit',
        id: tripId,
        stage: 'pre',
        answers: { t1: 'good' },
        notes: '',
        templateId: 'trip',
      },
      400,
    );
    await command('driver', {
      type: 'trip.submit',
      id: tripId,
      stage: 'pre',
      answers: { t1: 'good' },
      notes: '',
      templateId: 'trip',
    });
    await command(
      'mechanic',
      { type: 'trip.close', id: tripId, notes: '' },
      400,
    );
    await command('driver', {
      type: 'trip.submit',
      id: tripId,
      stage: 'post',
      answers: { t1: 'fault' },
      notes: 'Falla observada',
      templateId: 'trip',
    });
    await command('mechanic', {
      type: 'trip.close',
      id: tripId,
      notes: 'Revisado',
    });
    await command(
      'mechanic',
      { type: 'trip.close', id: tripId, notes: 'Segundo cierre' },
      400,
    );
    expect((await latest('driver')).trips[0]).toMatchObject({
      id: tripId,
      closingNotes: 'Revisado',
      closedBy: { id: actorIds.mechanic },
      template: { version: 2 },
    });
  });

  it('registra externos con costos propios, recarga sin tocar stock y rechaza roles/campos ajenos', async () => {
    const before = await latest();
    const value: Command = {
      type: 'external.record',
      vehicleId,
      input: {
        kind: 'roadside',
        date: dateToday(),
        description: 'Reparación externa',
        provider: 'Empresa de carretera',
        materialsCost: 123.45,
        laborCost: 0,
        notes: 'Sin inventario',
      },
    };
    for (const role of ['driver', 'warehouse', 'technician'])
      await command(role, value, 403);
    await command('mechanic', { ...value, vehicleId: randomUUID() }, 400);
    await command(
      'admin',
      { ...value, input: { ...value.input, materialsCost: -1 } },
      400,
    );
    await command(
      'admin',
      { ...value, input: { ...value.input, laborCost: 0.001 } },
      400,
    );
    await command(
      'admin',
      { ...value, input: { ...value.input, date: '2026-02-30' } },
      400,
    );
    await api()
      .post('/api/operations/commands')
      .set('Cookie', cookies.admin)
      .set('Origin', origin)
      .send({
        revision,
        commandId: randomUUID(),
        command: {
          ...value,
          input: { ...value.input, total: 1, actorId: 'forged' },
        },
      })
      .expect(400);
    const saved = await command('mechanic', value);
    await api()
      .post('/api/operations/commands')
      .set('Cookie', cookies.mechanic)
      .set('Origin', origin)
      .send(saved.envelope)
      .expect(201);
    const after = await latest();
    expect(after.workbench.externalServices).toHaveLength(1);
    expect(after.workbench.externalServices![0]).toMatchObject({
      busId: vehicleId,
      actorId: actorIds.mechanic,
      actorName: 'Prueba mechanic',
      date: dateToday(),
    });
    expect(externalTotal(after.workbench.externalServices![0])).toBe(123.45);
    expect(after.catalogs).toEqual(before.catalogs);
    expect(after.workbench.orders).toEqual(before.workbench.orders);
    expect(after.workbench.fleet).toEqual(before.workbench.fleet);
    expect(after.workbench.circulationDecisions).toBeUndefined();
    expect(
      (await latest('warehouse')).workbench.externalServices,
    ).toBeUndefined();
    expect((await latest('driver')).workbench.externalServices).toBeUndefined();
  });

  it('conserva decisiones explícitas y su historial sin autorización implícita inicial', async () => {
    const before = await latest();
    expect(before.workbench.circulationDecisions).toBeUndefined();
    for (const role of ['driver', 'warehouse', 'technician'])
      await command(
        role,
        { type: 'circulation.decide', vehicleId, status: 'authorized' },
        403,
      );
    await command('admin', {
      type: 'circulation.decide',
      vehicleId,
      status: 'authorized',
    });
    await command('mechanic', {
      type: 'circulation.decide',
      vehicleId,
      status: 'unauthorized',
    });
    const state = await latest();
    expect(state.workbench.circulationDecisions?.map((d) => d.status)).toEqual([
      'unauthorized',
      'authorized',
    ]);
    expect(state.workbench.circulationDecisions?.map((d) => d.actorId)).toEqual(
      [actorIds.mechanic, actorIds.admin],
    );
    expect(
      state.workbench.circulationDecisions?.every(
        (d) => d.busId === vehicleId && !Number.isNaN(Date.parse(d.recordedAt)),
      ),
    ).toBe(true);
    expect(
      (await latest('driver')).workbench.circulationDecisions,
    ).toBeUndefined();
    expect(
      (await latest('warehouse')).workbench.circulationDecisions,
    ).toBeUndefined();
  });

  it('consulta incidencias mínimas solo de la unidad del caso propio, incluyendo resueltas sin autores/costos', async () => {
    await latest();
    const otherBus = (await latest()).catalogs.vehicles.find(
      (v) => v.type === 'bus' && v.id !== vehicleId,
    )!;
    await command('mechanic', {
      type: 'damage.add',
      vehicleId: otherBus.id,
      input: {
        kind: 'Golpe',
        area: 'OTRA-UNIDAD',
        description: 'No debe aparecer',
        date: dateToday(),
      },
    });
    const path = `/api/operations/trips/${tripId}/incidents`;
    await api().get(path).expect(401);
    for (const role of ['warehouse', 'technician'])
      await api().get(path).set('Cookie', cookies[role]).expect(403);
    await api().get(path).set('Cookie', cookies.other).expect(404);
    await api()
      .get('/api/operations/trips/missing/incidents')
      .set('Cookie', cookies.driver)
      .expect(404);
    for (const role of ['driver', 'admin', 'mechanic']) {
      const response = await api()
        .get(path)
        .set('Cookie', cookies[role])
        .expect(200);
      const incidents = (
        response.body as {
          incidents: { id: string; resolved: boolean; title: string }[];
        }
      ).incidents;
      expect(incidents.some((i) => i.resolved)).toBe(true);
      expect(incidents.some((i) => !i.resolved)).toBe(true);
      expect(incidents.some((i) => i.title.includes('OTRA-UNIDAD'))).toBe(
        false,
      );
      for (const item of incidents)
        expect(Object.keys(item).sort()).toEqual([
          'date',
          'description',
          'id',
          'origin',
          'resolved',
          'title',
        ]);
      expect(JSON.stringify(incidents)).not.toContain(actorIds.mechanic);
      expect(JSON.stringify(incidents)).not.toContain('Prueba mechanic');
    }
  });

  it('rechaza cierre inferior a apertura, admite captura histórica sin usar máximo posterior y conserva circulación', async () => {
    const state = await latest();
    const id = randomUUID();
    await command('mechanic', {
      type: 'order.create',
      clientId: id,
      form: {
        ...form,
        sourceRequestId: undefined,
        services: form.services.map((s) => ({ ...s, materials: [] })),
      },
    });
    await command('mechanic', {
      type: 'order.change',
      id,
      action: 'start',
      notes: '',
    });
    const finish: Command = {
      type: 'order.finish',
      id,
      input: {
        date: '2026-01-01',
        odometer: 1,
        performedServiceIds: ['service-1'],
        unperformedReasons: {},
        notes: '',
      },
    };
    const failed = await command('mechanic', finish, 400);
    expect((failed.state as unknown as { message: string }).message).toContain(
      'apertura',
    );
    await command('mechanic', {
      ...finish,
      input: { ...finish.input, odometer: 1000 },
    });
    const after = await latest();
    expect(
      after.workbench.orders.find((o) => o.id === id)?.completion?.odometer,
    ).toBe(1000);
    expect(after.workbench.circulationDecisions).toEqual(
      state.workbench.circulationDecisions,
    );
    expect(after.workbench.externalServices).toEqual(
      state.workbench.externalServices,
    );
  });

  it('una Sprinter heredada conserva identidad/historial y completa solicitud, orden, revisión, externo y circulación', async () => {
    const before = await latest();
    const existing = before.catalogs.vehicles.find((v) => v.id === sprinterId)!;
    expect(existing.type).toBe('truck');
    expect(
      (await latest('driver')).catalogs.vehicles.find(
        (v) => v.id === sprinterId,
      ),
    ).toEqual(existing);
    const id = randomUUID(),
      request = randomUUID(),
      service = randomUUID();
    await command('driver', {
      type: 'request.create',
      clientId: request,
      input: {
        busId: sprinterId,
        title: 'Servicio Sprinter',
        description: 'Mantenimiento de pasajeros',
        odometer: '1000',
      },
    });
    await command('mechanic', {
      type: 'service.save',
      clientId: service,
      input: {
        name: 'Servicio Sprinter',
        category: 'Eléctrico',
        hours: 1,
        description: 'Revisar',
        compatibleVehicleIds: [sprinterId],
        materials: [{ productId, quantity: 1 }],
      },
    });
    await command('mechanic', {
      type: 'order.create',
      clientId: id,
      form: {
        ...form,
        busId: sprinterId,
        sourceRequestId: request,
        services: [
          {
            ...form.services[0],
            catalogId: service,
            name: 'Servicio Sprinter',
            materials: [{ id: 'spr-m', productId, quantity: 1 }],
          },
        ],
      },
    });
    await command('mechanic', {
      type: 'order.change',
      id,
      action: 'start',
      notes: '',
    });
    const finish: Command = {
      type: 'order.finish',
      id,
      input: {
        date: dateToday(),
        odometer: 1100,
        performedServiceIds: ['service-1'],
        unperformedReasons: {},
        notes: 'Sprinter terminada',
      },
    };
    await command('mechanic', finish, 400);
    await command('warehouse', {
      type: 'materials.confirm',
      id,
      totals: [{ productId, delivered: 1, returned: 0 }],
      notes: '',
    });
    await command('mechanic', finish);
    await command('mechanic', {
      type: 'review.record',
      vehicleId: sprinterId,
      templateId: 'general',
      input: {
        date: dateToday(),
        answers: { a1: 'good' },
        notes: 'General Sprinter',
      },
    });
    const stockBefore = await latest();
    for (const role of ['driver', 'warehouse', 'technician']) {
      await command(
        role,
        {
          type: 'external.record',
          vehicleId: sprinterId,
          input: {
            kind: 'roadside',
            date: dateToday(),
            description: 'Sprinter carretera',
            provider: 'Prestador',
            materialsCost: 5,
            laborCost: 10,
            notes: '',
          },
        },
        403,
      );
      await command(
        role,
        {
          type: 'circulation.decide',
          vehicleId: sprinterId,
          status: 'authorized',
        },
        403,
      );
    }
    await command('mechanic', {
      type: 'external.record',
      vehicleId: sprinterId,
      input: {
        kind: 'roadside',
        date: dateToday(),
        description: 'Sprinter carretera',
        provider: 'Prestador',
        materialsCost: 5,
        laborCost: 10,
        notes: '',
      },
    });
    await command('admin', {
      type: 'circulation.decide',
      vehicleId: sprinterId,
      status: 'authorized',
    });
    await command('mechanic', {
      type: 'circulation.decide',
      vehicleId: sprinterId,
      status: 'unauthorized',
    });
    const after = await latest();
    expect(after.catalogs).toEqual(stockBefore.catalogs);
    expect(after.workbench.orders).toEqual(stockBefore.workbench.orders);
    expect(after.catalogs.vehicles.find((v) => v.id === sprinterId)).toEqual(
      existing,
    );
    expect(
      after.workbench.fleet?.damages.find(
        (d) => d.id === 'sprinter-old-damage',
      ),
    ).toEqual(
      before.workbench.fleet?.damages.find(
        (d) => d.id === 'sprinter-old-damage',
      ),
    );
    expect(
      after.workbench.externalServices?.find((r) => r.busId === sprinterId)
        ?.description,
    ).toBe('Sprinter carretera');
    expect(
      after.workbench.circulationDecisions
        ?.filter((r) => r.busId === sprinterId)
        .map((r) => r.status),
    ).toEqual(['unauthorized', 'authorized']);
  });

  it('Sprinter completa pre/post/cierre manteniendo un solo caso abierto por unidad y roles', async () => {
    await latest();
    const id = randomUUID();
    const start: Command = {
      type: 'trip.start',
      clientId: id,
      input: {
        busId: sprinterId,
        departureDate: dateToday(),
        returnDate: dateToday(),
      },
    };
    for (const role of ['warehouse', 'mechanic', 'technician'])
      await command(role, start, 403);
    await command('driver', start);
    await command('other', { ...start, clientId: randomUUID() }, 400);
    const path = `/api/operations/trips/${id}/incidents`;
    const incidents = await api()
      .get(path)
      .set('Cookie', cookies.driver)
      .expect(200);
    expect(JSON.stringify(incidents.body)).toContain(
      'Historial anterior conservado',
    );
    await api().get(path).set('Cookie', cookies.other).expect(404);
    await command(
      'driver',
      {
        type: 'trip.submit',
        id,
        stage: 'post',
        answers: { t1: 'good' },
        notes: '',
        templateId: 'trip',
      },
      400,
    );
    await command('driver', {
      type: 'trip.submit',
      id,
      stage: 'pre',
      answers: { t1: 'fault' },
      notes: 'Sprinter pre',
      templateId: 'trip',
    });
    await command('mechanic', { type: 'trip.close', id, notes: '' }, 400);
    await command(
      'other',
      {
        type: 'trip.submit',
        id,
        stage: 'post',
        answers: { t1: 'good' },
        notes: '',
      },
      400,
    );
    await command('driver', {
      type: 'trip.submit',
      id,
      stage: 'post',
      answers: { t1: 'good' },
      notes: 'Sprinter post',
    });
    await command('driver', { type: 'trip.close', id, notes: '' }, 403);
    await command('mechanic', { type: 'trip.close', id, notes: 'Revisada' });
    await command('mechanic', { type: 'trip.close', id, notes: '' }, 400);
    const after = await latest();
    expect(after.trips.find((t) => t.id === id)).toMatchObject({
      busId: sprinterId,
      fleetNumber: 'SPR-EXISTENTE',
      closingNotes: 'Revisada',
      pre: { notes: 'Sprinter pre' },
      post: { notes: 'Sprinter post' },
    });
    expect(
      after.workbench.circulationDecisions?.find((r) => r.busId === sprinterId)
        ?.status,
    ).toBe('unauthorized');
    await command('driver', { ...start, clientId: randomUUID() });
  });

  it('serializa capturas simultáneas sin perder entradas y conserva auditoría', async () => {
    await latest();
    const bodies = [1, 2].map((n) => ({
      commandId: randomUUID(),
      revision,
      command: {
        type: 'stock.add',
        id: productId,
        input: {
          quantity: n,
          unitCost: 100,
          occurredOn: dateToday(),
          supplier: '',
          receiptReference: '',
        },
      },
    }));
    const responses = await Promise.all(
      bodies.map((body) =>
        api()
          .post('/api/operations/commands')
          .set('Cookie', cookies.warehouse)
          .set('Origin', origin)
          .send(body),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (await latest()).catalogs.products.find((p) => p.id === productId)
        ?.entries,
    ).toHaveLength(2);
    expect(await prisma.operationEvent.count()).toBe(revision);
    const row = await prisma.operationState.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(row.revision).toBe(revision);
  });
});
