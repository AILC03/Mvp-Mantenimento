import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Bus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { vehicleInput } from './vehicle-input';

function publicVehicle(bus: Bus) {
  return {
    id: bus.id,
    fleetNumber: bus.fleetNumber,
    type: bus.vehicleType === 'BUS' ? 'bus' : 'truck',
    brand: bus.brand ?? '',
    model: bus.model ?? '',
    plate: bus.licensePlate ?? '',
    vin: bus.vin ?? '',
    year: bus.modelYear,
    odometer: bus.odometerKm,
    note: bus.notes,
    version: bus.version,
  };
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const buses = await this.prisma.bus.findMany({
      where: { isActive: true },
      orderBy: { fleetNumber: 'asc' },
    });
    return { vehicles: buses.map(publicVehicle) };
  }

  async create(body: unknown) {
    const { data } = vehicleInput(body);
    try {
      return publicVehicle(await this.prisma.bus.create({ data }));
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(id: string, body: unknown) {
    const { data, version } = vehicleInput(body, true);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.bus.updateMany({
          where: { id, version, isActive: true },
          data: { ...data, version: { increment: 1 } },
        });
        if (!result.count) {
          const existing = await tx.bus.findUnique({ where: { id } });
          if (!existing?.isActive)
            throw new NotFoundException('La unidad no existe.');
          throw new ConflictException(
            'Otra persona modificó la unidad. Recarga antes de guardar.',
          );
        }
        const updated = await tx.bus.findUniqueOrThrow({ where: { id } });
        return publicVehicle(updated);
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException(
        'Ya existe una unidad con ese número económico, placa o VIN.',
      );
    throw error;
  }
}
