import { randomUUID } from 'node:crypto';
import {
  applyCommand,
  defaultCatalogs,
  emptyForm,
  emptyWorkshop,
  workshop,
  loadWorkbench,
  loadTripCases,
  availableStock,
  orderMaterials,
  latestCirculation,
  saveVehicle,
  saveProduct,
  saveService,
  type OperationsState,
  type Command,
  type AuthUser,
  type OrderForm,
} from '@real-ejecutivo/domain';
import { parseEnvelope } from './command-schema';

const mechanic: AuthUser = {
  id: 'mechanic',
  username: 'mechanic',
  name: 'Mecánico',
  role: 'LEAD_MECHANIC',
};
const driver: AuthUser = {
  ...mechanic,
  id: 'driver',
  name: 'Chofer',
  role: 'DRIVER',
};
const warehouse: AuthUser = {
  ...mechanic,
  id: 'warehouse',
  role: 'WAREHOUSE_CLERK',
};
function fixture(): OperationsState {
  const catalogs = defaultCatalogs();
  catalogs.products.forEach((p) => {
    p.entries = [
      {
        id: randomUUID(),
        quantity: 50,
        unitCost: p.cost,
        occurredOn: '2026-01-01',
        supplier: 'Prueba',
        receiptReference: '',
        createdAt: new Date().toISOString(),
      },
    ];
  });
  catalogs.reviews.find((v) => v.id === 'trip')!.aspects = [
    { id: 'door', text: 'Puerta' },
  ];
  const w = emptyWorkshop();
  w.employees.push({
    id: 'employee',
    name: 'Persona del taller',
    position: 'Mecánico',
    phone: '',
    active: true,
  });
  w.suppliers.push(
    {
      id: 'supplier',
      name: 'Servicio prueba',
      kind: 'service',
      service: 'Electricidad',
      location: '',
      phone: '123',
      officePhone: '',
      email: '',
      notes: '',
      active: true,
    },
    {
      id: 'materials',
      name: 'Materiales prueba',
      kind: 'materials',
      service: '',
      location: '',
      phone: '456',
      officePhone: '',
      email: '',
      notes: '',
      active: true,
    },
  );
  w.parts.push({
    id: 'part',
    identifier: 'PART-123',
    name: 'Puerta por pedido',
    supplierId: 'materials',
    cost: 120,
    vehicleIds: ['BUS015'],
    notes: '',
    active: true,
  });
  w.articles.push({
    id: 'article',
    busId: 'BUS015',
    name: 'Escoba',
    category: 'Producto de limpieza',
    quantity: 2,
    active: true,
  });
  return {
    catalogs,
    workbench: { orders: [], requests: [], workshop: w },
    trips: [],
  };
}
function run(state: OperationsState, command: Command, user = mechanic) {
  parseEnvelope({ commandId: randomUUID(), revision: 0, command });
  return applyCommand(state, user, command, 1);
}
function form(): OrderForm {
  return {
    ...emptyForm(),
    busId: 'BUS015',
    odometer: '100',
    assignee: { kind: 'employee', id: 'employee', name: 'Nombre falsificado' },
    services: [
      {
        id: 'free',
        catalogId: 'free:repair',
        freeText: true,
        maintenanceType: 'corrective',
        name: 'Reparar puerta',
        instructions: 'Ajustar apertura de puerta',
        category: 'Puerta',
        hours: 1,
        assignee: '',
        materials: [],
      },
    ],
  };
}
const create = (state: OperationsState, f = form(), id = randomUUID()) =>
  run(state, { type: 'order.create', form: f, clientId: id });

describe('Ajustes finales del MVP', () => {
  it('exige VIN para nuevas altas y conserva fichas históricas incompletas', () => {
    const c = defaultCatalogs();
    expect(() =>
      saveVehicle(c, { ...c.vehicles[0], fleetNumber: 'NEW' }),
    ).toThrow('VIN');
    expect(
      saveVehicle(c, c.vehicles[0], c.vehicles[0].id).vehicles[0].vin,
    ).toBe('');
  });
  it('permite límites opcionales y rechaza mínimo mayor al máximo', () => {
    const c = defaultCatalogs();
    const entry = {
      quantity: 0,
      unitCost: 0,
      occurredOn: '',
      supplier: '',
      receiptReference: '',
    };
    expect(() =>
      saveProduct(
        c,
        {
          sku: 'NEW',
          name: 'Pieza',
          description: '',
          unit: 'pza',
          minStock: 5,
          maxStock: 2,
        },
        entry,
      ),
    ).toThrow('mínimo');
    expect(
      saveProduct(
        c,
        { sku: 'NEW', name: 'Pieza', description: '', unit: 'pza' },
        entry,
      ).products.at(-1)?.minStock,
    ).toBeUndefined();
    const input = {
      sku: 'LIMITS',
      name: 'Pieza',
      description: '',
      unit: 'pza' as const,
    };
    const limited = saveProduct(
      c,
      { ...input, minStock: 5, maxStock: 10 },
      entry,
    );
    const id = limited.products.at(-1)!.id;
    expect(
      saveProduct(limited, input, entry, id).products.at(-1)?.minStock,
    ).toBe(5);
    expect(() =>
      saveProduct(limited, { ...input, maxStock: 2 }, entry, id),
    ).toThrow('mínimo');
  });
  it('admite preventivos y correctivos nuevos sin reclasificar existentes', () => {
    const c = defaultCatalogs();
    const original = structuredClone(c.services);
    const n = saveService(c, {
      name: 'Preventivo adicional',
      maintenanceType: 'preventive',
      hours: 1,
      category: '',
      description: '',
      materials: [],
      compatibleVehicleIds: [],
    });
    expect(n.services.slice(0, -1)).toEqual(original);
    const preventive = n.services.at(-1)!;
    expect(
      saveService(
        n,
        { ...preventive, maintenanceType: undefined },
        preventive.id,
      ).services.at(-1)?.maintenanceType,
    ).toBe('preventive');
    expect(() =>
      saveService(
        c,
        { ...c.services[1], maintenanceType: 'preventive' },
        c.services[1].id,
      ),
    ).toThrow('conserva');
  });
  it('bloquea desde creación y resuelve responsable en servidor sin modificar comando', () => {
    const s = fixture(),
      f = form(),
      copy = structuredClone(f);
    const n = create(s, f);
    expect(f).toEqual(copy);
    expect(n.workbench.orders[0].form.assignee?.name).toBe(
      'Persona del taller',
    );
    expect(latestCirculation(n.workbench, 'BUS015')?.status).toBe(
      'unauthorized',
    );
    expect(s.workbench.orders).toHaveLength(0);
  });
  it('rechaza responsable ausente o de materiales y permisos negativos', () => {
    const s = fixture();
    expect(() => create(s, { ...form(), assignee: undefined })).toThrow(
      'responsable',
    );
    expect(() =>
      create(s, {
        ...form(),
        assignee: { kind: 'supplier', id: 'materials', name: '' },
      }),
    ).toThrow('Responsable');
    expect(() =>
      run(
        s,
        {
          type: 'workshop.save',
          change: {
            entity: 'employee',
            value: workshop(s.workbench).employees[0],
          },
        },
        driver,
      ),
    ).toThrow('perfil');
    expect(() =>
      run(
        s,
        {
          type: 'workshop.save',
          change: {
            entity: 'employee',
            value: workshop(s.workbench).employees[0],
          },
        },
        warehouse,
      ),
    ).toThrow('perfil');
  });
  it('permite autorizar pausadas, reanudar bloquea y otra orden impide autorización', () => {
    let s = create(fixture());
    const id = s.workbench.orders[0].id;
    const change = (action: 'start' | 'pause' | 'resume') => {
      s = run(s, { type: 'order.change', id, action, notes: 'Motivo' });
    };
    change('start');
    change('pause');
    s = run(s, {
      type: 'circulation.decide',
      vehicleId: 'BUS015',
      status: 'authorized',
    });
    expect(latestCirculation(s.workbench, 'BUS015')?.status).toBe('authorized');
    change('resume');
    expect(latestCirculation(s.workbench, 'BUS015')?.status).toBe(
      'unauthorized',
    );
    s = create(s);
    expect(() =>
      run(s, {
        type: 'order.finish',
        id,
        input: {
          date: '2026-01-01',
          odometer: 100,
          performedServiceIds: ['free'],
          unperformedReasons: {},
          notes: '',
          authorizeCirculation: true,
        },
      }),
    ).toThrow('órdenes abiertas');
    expect(s.workbench.orders.find((v) => v.id === id)?.status).toBe(
      'En proceso',
    );
  });
  it('cierre autoriza solo con opción explícita', () => {
    let s = create(fixture());
    const id = s.workbench.orders[0].id;
    s = run(s, { type: 'order.change', id, action: 'start', notes: '' });
    s = run(s, {
      type: 'order.finish',
      id,
      input: {
        date: '2026-01-01',
        odometer: 100,
        performedServiceIds: ['free'],
        unperformedReasons: {},
        notes: '',
        authorizeCirculation: true,
      },
    });
    expect(latestCirculation(s.workbench, 'BUS015')?.status).toBe('authorized');
  });
  it('corrección de devuelto 1 a 0 conserva historial y revalida stock', () => {
    const f = form();
    f.services[0].materials = [{ id: 'm', productId: 'filter', quantity: 1 }];
    let s = create(fixture(), f);
    const id = s.workbench.orders[0].id;
    const confirm = (returned: number, notes = '') =>
      run(
        s,
        {
          type: 'materials.confirm',
          id,
          totals: [{ productId: 'filter', delivered: 1, returned }],
          notes,
        },
        warehouse,
      );
    s = confirm(0);
    s = confirm(1);
    expect(() => confirm(0)).toThrow('Explica');
    s = confirm(0, 'Sí lo necesita otra vez');
    expect(orderMaterials(s.workbench.orders[0])[0]).toMatchObject({
      delivered: 1,
      returned: 0,
    });
    expect(s.workbench.orders[0].materialConfirmations).toHaveLength(3);
    expect(
      availableStock(
        s.catalogs.products.find((v) => v.id === 'filter')!,
        s.workbench.orders,
      ),
    ).toBe(49);
    expect(
      loadWorkbench(JSON.stringify(s.workbench)).orders[0]
        .materialConfirmations,
    ).toHaveLength(3);
  });
  it('piezas por pedido requieren recepción y entrega por almacén sin modificar stock', () => {
    const f = form();
    f.orderedParts = [
      {
        partId: 'part',
        identifier: '',
        name: '',
        supplier: '',
        quantity: 1,
        unitCost: 999,
      },
    ];
    let s = create(fixture(), f);
    const id = s.workbench.orders[0].id;
    const c: Command = {
      type: 'parts.confirm',
      id,
      lines: [{ partId: 'part', received: 0, delivered: 1, returned: 0 }],
      notes: '',
    };
    expect(() => run(s, c, mechanic)).toThrow('perfil');
    expect(() => run(s, c, warehouse)).toThrow('recepción');
    s = run(
      s,
      {
        ...c,
        lines: [{ partId: 'part', received: 1, delivered: 1, returned: 0 }],
      },
      warehouse,
    );
    expect(s.catalogs.products).toEqual(
      fixture().catalogs.products.map((v, i) => ({
        ...v,
        entries: s.catalogs.products[i].entries,
      })),
    );
    s = run(s, { type: 'order.change', id, action: 'start', notes: '' });
    s = run(s, {
      type: 'order.finish',
      id,
      input: {
        date: '2026-01-01',
        odometer: 100,
        performedServiceIds: ['free'],
        unperformedReasons: {},
        notes: '',
      },
    });
    expect(s.workbench.orders[0].status).toBe('Finalizada');
  });
  it('externo vinculado guarda un solo costo y valida proveedor/orden', () => {
    let s = create(fixture(), {
      ...form(),
      assignee: { kind: 'supplier', id: 'supplier', name: '' },
    });
    const id = s.workbench.orders[0].id;
    const input = {
      kind: 'external' as const,
      date: '2026-01-01',
      description: 'Reparación',
      provider: 'Servicio prueba',
      providerId: 'supplier',
      orderId: id,
      materialsCost: 0,
      laborCost: 500,
      notes: '',
    };
    s = run(s, { type: 'external.record', vehicleId: 'BUS015', input });
    expect(() =>
      run(s, { type: 'external.record', vehicleId: 'BUS015', input }),
    ).toThrow('ya tiene');
    expect(s.workbench.externalServices).toHaveLength(1);
    expect(s.workbench.orders[0].materialConfirmations).toBeUndefined();
  });
  it('pre/post descuenta y recupera artículos una vez con observaciones y solicitud vinculada', () => {
    let s = fixture();
    s = run(
      s,
      {
        type: 'trip.start',
        input: {
          busId: 'BUS015',
          departureDate: '2026-01-01',
          returnDate: '2026-01-02',
        },
        clientId: randomUUID(),
      },
      driver,
    );
    const id = s.trips[0].id;
    const command: Command = {
      type: 'trip.submit',
      id,
      stage: 'pre',
      templateId: 'trip',
      answers: { door: 'fault' },
      notes: 'Falla puerta y falta escoba',
      articleCounts: { article: 1 },
      faultActions: { door: 'request' },
    };
    expect(() => run(s, { ...command, notes: '' }, driver)).toThrow(
      'obligatorias',
    );
    s = run(s, command, driver);
    expect(workshop(s.workbench).articles[0].quantity).toBe(1);
    expect(s.workbench.requests[0].sourceIncidentId).toContain(id);
    expect(() => run(s, command, driver)).toThrow('ya fue');
    s = run(
      s,
      {
        type: 'trip.submit',
        id,
        stage: 'post',
        answers: { door: 'good' },
        notes: 'Se recuperó escoba',
        articleCounts: { article: 2 },
      },
      driver,
    );
    expect(workshop(s.workbench).articles[0].quantity).toBe(2);
    expect(workshop(s.workbench).articleMovements).toHaveLength(2);
    expect(
      loadTripCases(JSON.stringify(s.trips))[0].pre?.articles?.[0].quantity,
    ).toBe(1);
  });
  it('antecedente histórico no altera stock ni circulación y general pasa a 30 sin cambiar snapshots', () => {
    let s = fixture();
    s.catalogs.reviews[0].intervalDays = 45;
    s = run(s, {
      type: 'workshop.save',
      change: {
        entity: 'historical',
        value: {
          id: randomUUID(),
          busId: 'BUS015',
          date: '2025-01-01',
          description: 'Reparación anterior',
          provider: 'Antiguo',
          cost: null,
          odometer: null,
          notes: '',
        },
      },
    });
    expect(s.catalogs.reviews[0].intervalDays).toBe(30);
    expect(s.workbench.circulationDecisions).toBeUndefined();
    expect(
      workshop(loadWorkbench(JSON.stringify(s.workbench))).historicalRepairs[0]
        .actorId,
    ).toBe(mechanic.id);
  });
  it('chofer reporta golpe o falla con solicitud opcional sin atribuir causante', () => {
    const c: Command = {
      type: 'request.create',
      clientId: randomUUID(),
      input: {
        busId: 'BUS015',
        title: 'Puerta',
        description: 'No abre',
        odometer: '',
        reportKind: 'Falla',
        createServiceRequest: false,
      },
    };
    const s = run(fixture(), c, driver);
    expect(s.workbench.requests).toHaveLength(0);
    expect(s.workbench.fleet?.damages[0]).toMatchObject({
      kind: 'Falla',
      actorId: driver.id,
    });
    expect(s.workbench.fleet?.damages[0].responsible).toBeUndefined();
  });
});
