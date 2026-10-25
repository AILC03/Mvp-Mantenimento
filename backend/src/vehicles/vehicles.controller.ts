import {
  Controller,
  Get,
  GoneException,
  Header,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OperationsService } from '../operations/operations.service';

// Compatibilidad de lectura. Evita dos fuentes de verdad tras la migración.
@Controller('api/vehicles')
@UseGuards(AuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly operations: OperationsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: AuthenticatedRequest) {
    const state = await this.operations.snapshot(request.auth.user);
    return { vehicles: state.catalogs.vehicles, revision: state.revision };
  }
  @Post()
  @Roles('ADMIN')
  create() {
    throw new GoneException(
      'Usa vehicle.save en /api/operations/commands. No se modificó la unidad.',
    );
  }
  @Put(':id')
  @Roles('ADMIN')
  update() {
    throw new GoneException(
      'Usa vehicle.save en /api/operations/commands. No se modificó la unidad.',
    );
  }
}
