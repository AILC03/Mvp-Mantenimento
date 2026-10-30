import { BadRequestException } from '@nestjs/common';

export function vehicleInput(body: unknown, updating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Los datos de la unidad no son válidos.');
  const input = body as Record<string, unknown>;
  const fields = [
    'fleetNumber',
    'type',
    'brand',
    'model',
    'plate',
    'vin',
    'year',
    'odometer',
    'note',
  ];
  if (updating) fields.push('version');
  if (Object.keys(input).some((key) => !fields.includes(key)))
    throw new BadRequestException(
      'La solicitud contiene campos no permitidos.',
    );
  const text = (key: string, max: number, required = false) => {
    const value = input[key];
    if (
      typeof value !== 'string' ||
      value.trim().length > max ||
      (required && !value.trim())
    )
      throw new BadRequestException(`El campo ${key} no es válido.`);
    return value.trim();
  };
  const fleetNumber = text('fleetNumber', 30, true).toUpperCase();
  const plate = text('plate', 30).toUpperCase();
  const vin = text('vin', 17).toUpperCase();
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))
    throw new BadRequestException('El VIN debe tener 17 caracteres válidos.');
  if (input.type !== 'bus' && input.type !== 'truck')
    throw new BadRequestException('Selecciona Autobús o Sprinter.');
  if (
    input.year !== null &&
    (typeof input.year !== 'number' ||
      !Number.isInteger(input.year) ||
      input.year < 1950 ||
      input.year > new Date().getFullYear() + 1)
  )
    throw new BadRequestException('El año de la unidad no es válido.');
  if (
    typeof input.odometer !== 'number' ||
    !Number.isInteger(input.odometer) ||
    input.odometer < 0 ||
    input.odometer > 2147483647
  )
    throw new BadRequestException(
      'El kilometraje debe ser un entero no negativo.',
    );
  if (
    updating &&
    (typeof input.version !== 'number' ||
      !Number.isInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647)
  )
    throw new BadRequestException('La versión de la unidad no es válida.');
  return {
    data: {
      fleetNumber,
      licensePlate: plate || null,
      vin: vin || null,
      brand: text('brand', 80),
      model: text('model', 80),
      modelYear: input.year,
      vehicleType: input.type === 'bus' ? ('BUS' as const) : ('TRUCK' as const),
      odometerKm: input.odometer,
      notes: text('note', 4000),
    },
    version: updating ? (input.version as number) : undefined,
  };
}
