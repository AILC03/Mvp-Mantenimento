import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OperationsService } from './operations.service';

@Controller('api/operations')
@UseGuards(AuthGuard)
export class OperationsController {
  constructor(
    private readonly operations: OperationsService,
    private readonly config: ConfigService,
  ) {}
  private origin(request: AuthenticatedRequest) {
    const allowed = String(
      this.config.get('FRONTEND_ORIGINS') ??
        'http://127.0.0.1:5173,http://localhost:5173',
    )
      .split(',')
      .map((v) => v.trim());
    if (!request.headers.origin || !allowed.includes(request.headers.origin))
      throw new ForbiddenException('Origen no permitido.');
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  snapshot(@Req() request: AuthenticatedRequest) {
    return this.operations.snapshot(request.auth.user);
  }
  @Post('commands')
  @Header('Cache-Control', 'no-store')
  command(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    this.origin(request);
    return this.operations.execute(request.auth.user, body);
  }
  @Post('import')
  @Header('Cache-Control', 'no-store')
  import(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    this.origin(request);
    return this.operations.importLegacy(request.auth.user, body);
  }
}
