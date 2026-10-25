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
    const legacy = {
      catalogs,
      workbench: {
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
