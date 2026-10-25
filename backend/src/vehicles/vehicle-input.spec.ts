import { vehicleInput } from './vehicle-input';

const valid = {
  fleetNumber: ' cam-01 ',
  type: 'truck',
  brand: 'Marca',
  model: 'Modelo',
  plate: '',
  vin: '',
  year: null,
  odometer: 0,
  note: '',
};

describe('vehicleInput', () => {
  it('normaliza claves únicas y permite campos opcionales vacíos', () => {
    expect(vehicleInput(valid).data).toMatchObject({
      fleetNumber: 'CAM-01',
      vehicleType: 'TRUCK',
      licensePlate: null,
      vin: null,
      odometerKm: 0,
    });
  });
  it.each([
    null,
    [],
    'unidad',
    { ...valid, id: 'BUS015' },
    { ...valid, isActive: false },
    { ...valid, fleetNumber: '' },
    { ...valid, type: 'other' },
    { ...valid, odometer: -1 },
    { ...valid, odometer: 1.5 },
    { ...valid, odometer: '12' },
    { ...valid, odometer: 2147483648 },
    { ...valid, year: 1800 },
    { ...valid, vin: 'invalido' },
    { ...valid, note: 'x'.repeat(4001) },
  ])('rechaza datos inválidos y campos ajenos: %j', (body) => {
    expect(() => vehicleInput(body)).toThrow();
  });
  it('requiere versión entera al editar', () => {
    expect(() => vehicleInput(valid, true)).toThrow();
    expect(() => vehicleInput({ ...valid, version: 0 }, true)).toThrow();
    expect(vehicleInput({ ...valid, version: 1 }, true).version).toBe(1);
  });
});
