import { randomUUID } from 'node:crypto';
import {
  applyCommand,
  defaultCatalogs,
  emptyForm,
  normalizeCatalogs,
  loadWorkbench,
  availableStock,
  orderMaterials,
  circulationState,
  latestCirculation,
  dateToday,
  vehicleIncidents,
  type AuthUser,
  type OperationsState,
  type OrderForm,
} from '@real-ejecutivo/domain';
import { parseEnvelope } from './command-schema';

const admin: AuthUser = {
  id: 'admin',
  username: 'admin',
  name: 'Admin',
  role: 'ADMIN',
};
const driver: AuthUser = {
  ...admin,
  id: 'driver',
  name: 'Chofer',
  role: 'DRIVER',
};
const warehouse: AuthUser = {
  ...admin,
  id: 'warehouse',
  role: 'WAREHOUSE_CLERK',
};
const initial = (): OperationsState => ({
  catalogs: defaultCatalogs(),
  workbench: { orders: [], requests: [] },
  trips: [],
});
const command = (
  state: OperationsState,
  input: Parameters<typeof applyCommand>[2],
  user = admin,
) =>
  applyCommand(
    state,
    user,
    parseEnvelope({ commandId: randomUUID(), revision: 0, command: input })
      .command,
    1,
  );
const orderForm = (): OrderForm => ({
  ...emptyForm(),
  busId: 'BUS015',
  odometer: '1000',
  services: [
    {
      id: 'service',
      catalogId: '',
      name: 'Ajustar puerta',
      category: 'Correctivo',
      assignee: '',
      hours: 1,
      instructions: '',
      materials: [],
    },
  ],
});

describe('Últimos cambios: reglas y contratos', () => {
  it('completa catálogos/VIN de forma idempotente, conserva IDs y plantillas capturadas', () => {
    const state = initial();
    const historical = {
      ...state.catalogs.reviews[0],
      intervalDays: 45,
      aspects: [{ id: 'a', text: 'Puerta' }],
    };
    state.catalogs.reviews[0] = historical;
    state.catalogs.vehicles[0].vin = '';
    const before = structuredClone(state.catalogs);
    const next = normalizeCatalogs(before);
    expect(next.vehicles[0].id).toBe(before.vehicles[0].id);
    expect(next.vehicles[0].vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    expect(next.reviews[0]).toMatchObject({
      intervalDays: 30,
      version: historical.version + 1,
      aspects: historical.aspects,
    });
    expect(normalizeCatalogs(next)).toEqual(next);
    expect(before.vehicles[0].vin).toBe('');
    expect(historical.intervalDays).toBe(45);
  });
  it('exige VIN válido en altas y conserva claves truck', () => {
    const state = initial();
    const { id: existingId, ...vehicle } = state.catalogs.vehicles[0];
    expect(existingId).toBe('BUS015');
    const input = {
      ...vehicle,
      fleetNumber: 'SPR-2',
      plate: '',
      type: 'truck' as const,
      vin: '',
    };
    expect(() =>
      command(state, { type: 'vehicle.save', input, clientId: randomUUID() }),
    ).toThrow('VIN');
    const next = command(state, {
      type: 'vehicle.save',
      input: { ...input, vin: '1HGCM82633A004352' },
      clientId: randomUUID(),
    });
    expect(next.catalogs.vehicles.at(-1)?.type).toBe('truck');
  });
  it('registra directamente falla de chofer y reserva resolución al mecánico', () => {
    const next = command(
      initial(),
      {
        type: 'damage.add',
        vehicleId: 'BUS015',
        input: {
          kind: 'Falla',
          area: 'Puerta',
          description: 'No cierra',
          date: dateToday(),
          responsible: 'Persona reportada',
        },
      },
      driver,
    );
    const incident = vehicleIncidents('BUS015', next.workbench, [])[0];
    expect(incident.resolution).toBeUndefined();
    expect(next.workbench.fleet?.damages[0]).toMatchObject({
      kind: 'Falla',
      actorId: driver.id,
      responsible: 'Persona reportada',
    });
    expect(next.workbench.requests).toHaveLength(0);
    expect(() =>
      command(
        next,
        {
          type: 'incident.resolve',
          vehicleId: 'BUS015',
          sourceId: incident.sourceId,
          orderId: '',
          notes: 'Reparada',
        },
        driver,
      ),
    ).toThrow('perfil');
    expect(() =>
      command(
        next,
        {
          type: 'circulation.decide',
          vehicleId: 'BUS015',
          status: 'authorized',
        },
        driver,
      ),
    ).toThrow('perfil');
  });
  it('chofer registra externos con mano de obra explícita, no altera stock y no edita proveedores', () => {
    const state = initial();
    const input = {
      kind: 'external' as const,
      date: dateToday(),
      description: 'Reparación',
      provider: 'Proveedor',
      materialsCost: 0,
      laborCost: 10,
      notes: '',
    };
    const next = command(
      state,
      { type: 'external.record', vehicleId: 'BUS015', input },
      driver,
    );
    expect(next.workbench.externalServices?.[0].actorId).toBe(driver.id);
    expect(next.catalogs.products).toEqual(state.catalogs.products);
    expect(() =>
      parseEnvelope({
        commandId: randomUUID(),
        revision: 0,
        command: {
          type: 'external.record',
          vehicleId: 'BUS015',
          input: { ...input, laborCost: undefined },
        },
      }),
    ).toThrow();
    expect(() =>
      command(
        state,
        {
          type: 'provider.save',
          id: 'x',
          clientId: 'x',
          input: { name: 'X', contact: '', phone: '' },
        },
        driver,
      ),
    ).toThrow('solo');
  });
  it('catálogos nuevos comprueban compatibilidad, duplicados y permisos negativos', () => {
    const id = randomUUID();
    const next = command(initial(), {
      type: 'employee.save',
      clientId: id,
      input: { name: 'Ana', position: 'Mecánica', phone: '' },
    });
    expect(next.catalogs.employees[0].id).toBe(id);
    expect(() =>
      command(next, {
        type: 'employee.save',
        clientId: randomUUID(),
        input: { name: 'Ana', position: 'Mecánica', phone: '' },
      }),
    ).toThrow('registrado');
    expect(() =>
      command(next, {
        type: 'part.save',
        clientId: randomUUID(),
        input: {
          name: 'Faro',
          partNumber: 'P1',
          note: '',
          compatibleVehicleIds: ['missing'],
        },
      }),
    ).toThrow('compatibles');
    expect(() =>
      command(
        next,
        {
          type: 'employee.save',
          clientId: randomUUID(),
          input: { name: 'B', position: 'Taller', phone: '' },
        },
        warehouse,
      ),
    ).toThrow('perfil');
  });
  it('baja de empleado conserva referencia histórica y excluye nuevas asignaciones', () => {
    const id = randomUUID();
    let state = command(initial(), {
      type: 'employee.save',
      clientId: id,
      input: { name: 'Ana', position: 'Mecánica', phone: '' },
    });
    const form = {
      ...orderForm(),
      responsible: { kind: 'taller' as const, refId: id, name: 'Ana' },
    };
    state = command(state, {
      type: 'order.create',
      form,
      clientId: randomUUID(),
    });
    state = command(state, {
      type: 'employee.save',
      id,
      clientId: id,
      input: { name: 'Ana', position: 'Mecánica', phone: '', active: false },
    });
    expect(state.workbench.orders[0].form.responsible?.name).toBe('Ana');
    expect(() =>
      command(state, { type: 'order.create', form, clientId: randomUUID() }),
    ).toThrow('responsable');
  });
  it('valida stock mínimo/máximo opcional sin generar entradas', () => {
    const input = {
      sku: 'X',
      name: 'Artículo',
      description: '',
      unit: 'pza' as const,
      minStock: 2,
      maxStock: 1,
    };
    const initialEntry = {
      quantity: 0,
      unitCost: 0,
      occurredOn: '',
      supplier: '',
      receiptReference: '',
    };
    expect(() =>
      command(initial(), {
        type: 'product.save',
        input,
        initial: initialEntry,
        clientId: randomUUID(),
      }),
    ).toThrow('mínimo');
    const state = command(initial(), {
      type: 'product.save',
      input: { ...input, maxStock: null },
      initial: initialEntry,
      clientId: randomUUID(),
    });
    expect(state.catalogs.products.at(-1)).toMatchObject({
      minStock: 2,
      maxStock: null,
      entries: [],
    });
  });
  it('acepta varios correctivos libres y piezas compatibles sin exigir almacén', () => {
    const id = randomUUID();
    const state = command(initial(), {
      type: 'part.save',
      clientId: id,
      input: {
        name: 'Faro',
        partNumber: 'F-1',
        note: '',
        compatibleVehicleIds: ['BUS015'],
      },
    });
    const base = orderForm();
    const form = {
      ...base,
      services: [
        ...base.services,
        { ...base.services[0], id: 'other', name: 'Ajustar asiento' },
      ],
      partMaterials: [
        {
          id: 'part-line',
          partId: id,
          partNumber: 'F-1',
          name: 'Faro',
          quantity: 2,
        },
      ],
    };
    const next = command(state, {
      type: 'order.create',
      form,
      clientId: randomUUID(),
    });
    expect(next.workbench.orders[0].form.partMaterials?.[0].quantity).toBe(2);
    expect(next.catalogs.products).toEqual(state.catalogs.products);
    expect(() =>
      command(state, {
        type: 'order.create',
        form: { ...form, busId: 'BUS008' },
        clientId: randomUUID(),
      }),
    ).toThrow('compatibilidad');
  });
  it('corrige devolución hacia cero con auditoría, sin reescribir capturas ni costos', () => {
    let state = initial();
    state.catalogs.products[1].entries = [
      {
        id: 'entry',
        quantity: 10,
        unitCost: 480,
        occurredOn: dateToday(),
        supplier: '',
        receiptReference: '',
        createdAt: new Date().toISOString(),
      },
    ];
    const form = orderForm();
    form.services[0].materials = [
      { id: 'm', productId: 'filter', quantity: 1 },
    ];
    const id = randomUUID();
    state = command(state, { type: 'order.create', form, clientId: id });
    state = command(
      state,
      {
        type: 'materials.confirm',
        id,
        totals: [{ productId: 'filter', delivered: 5, returned: 4 }],
        notes: '',
      },
      warehouse,
    );
    const first = structuredClone(
      state.workbench.orders[0].materialConfirmations![0],
    );
    const change = {
      type: 'materials.confirm' as const,
      id,
      totals: [{ productId: 'filter', delivered: 5, returned: 0 }],
      notes: 'Captura errónea de devolución',
    };
    expect(() => command(state, { ...change, notes: '' }, warehouse)).toThrow(
      'motivo',
    );
    state = command(state, change, warehouse);
    expect(orderMaterials(state.workbench.orders[0])[0]).toMatchObject({
      delivered: 5,
      returned: 0,
    });
    expect(state.workbench.orders[0].materialConfirmations![0]).toEqual(first);
    expect(state.workbench.orders[0].events?.at(-1)?.action).toBe(
      'Ajuste de materiales',
    );
    expect(
      availableStock(state.catalogs.products[1], state.workbench.orders),
    ).toBe(5);
    expect(loadWorkbench(JSON.stringify(state.workbench))).toEqual(
      state.workbench,
    );
    expect(() => command(state, change, driver)).toThrow('perfil');
  });
  it('orden en curso bloquea circulación sin actor inventado; cierre registra decisión humana', () => {
    let state = command(initial(), {
      type: 'circulation.decide',
      vehicleId: 'BUS015',
      status: 'authorized',
    });
    const id = randomUUID();
    state = command(state, {
      type: 'order.create',
      form: orderForm(),
      clientId: id,
    });
    state = command(state, {
      type: 'order.change',
      id,
      action: 'start',
      notes: '',
    });
    expect(circulationState(state.workbench, 'BUS015').effective).toBe(
      'unauthorized',
    );
    expect(latestCirculation(state.workbench, 'BUS015')?.status).toBe(
      'authorized',
    );
    expect(() =>
      command(state, {
        type: 'circulation.decide',
        vehicleId: 'BUS015',
        status: 'authorized',
      }),
    ).toThrow('curso');
    state = command(state, {
      type: 'order.finish',
      id,
      input: {
        date: dateToday(),
        odometer: 1000,
        performedServiceIds: ['service'],
        unperformedReasons: {},
        notes: '',
        authorizeCirculation: true,
      },
    });
    expect(circulationState(state.workbench, 'BUS015').effective).toBe(
      'authorized',
    );
    expect(latestCirculation(state.workbench, 'BUS015')?.actorId).toBe(
      admin.id,
    );
  });
  it('inventario de unidad se descuenta en post con registro, sin cambiar almacén', () => {
    let state = command(initial(), {
      type: 'inventory.save',
      vehicleId: 'BUS015',
      counts: [{ productId: 'filter', quantity: 2 }],
    });
    const products = structuredClone(state.catalogs.products);
    const id = randomUUID();
    state.catalogs.reviews.find((r) => r.id === 'trip')!.aspects = [
      { id: 'a', text: 'Puerta' },
    ];
    state = command(
      state,
      {
        type: 'trip.start',
        clientId: id,
        input: {
          busId: 'BUS015',
          departureDate: dateToday(),
          returnDate: dateToday(),
        },
      },
      driver,
    );
    const pre = {
      type: 'trip.submit' as const,
      id,
      stage: 'pre' as const,
      templateId: 'trip',
      answers: { a: 'fault' as const },
      notes: '',
      inventory: [{ productId: 'filter', quantity: 2 }],
    };
    expect(() => command(state, pre, driver)).toThrow('observaciones');
    state = command(state, { ...pre, notes: 'Puerta floja' }, driver);
    state = command(
      state,
      {
        ...pre,
        stage: 'post',
        notes: 'Puerta floja',
        inventory: [{ productId: 'filter', quantity: 0 }],
      },
      driver,
    );
    expect(state.workbench.unitInventories?.[0].items[0].quantity).toBe(0);
    expect(state.workbench.unitInventories?.[0].movements[0]).toMatchObject({
      quantity: 2,
      tripId: id,
      actorId: driver.id,
    });
    expect(state.trips[0].pre?.inventory?.[0].quantity).toBe(2);
    expect(state.catalogs.products).toEqual(products);
    expect(() =>
      command(state, { ...pre, stage: 'post', notes: 'Duplicado' }, driver),
    ).toThrow('enviada');
  });
});
