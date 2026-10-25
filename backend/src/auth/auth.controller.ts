import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { Roles, RolesGuard } from './roles.guard';
import {
  readSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  type AuthenticatedRequest,
} from './auth.types';

@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/api',
      maxAge: SESSION_DURATION_MS,
    };
  }

  private checkOrigin(request: Request): void {
    const allowed = String(
      this.config.get('FRONTEND_ORIGINS') ??
        'http://127.0.0.1:5173,http://localhost:5173',
    )
      .split(',')
      .map((origin) => origin.trim());
    if (!request.headers.origin || !allowed.includes(request.headers.origin))
      throw new ForbiddenException('Origen de la solicitud no permitido.');
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkOrigin(request);
    const session = await this.auth.login(body);
    response.cookie(SESSION_COOKIE, session.token, this.cookieOptions());
    return { user: session.user, expiresAt: session.expiresAt };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.auth;
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.checkOrigin(request);
    await this.auth.logout(readSessionToken(request));
    const options = this.cookieOptions();
    delete options.maxAge;
    response.clearCookie(SESSION_COOKIE, options);
  }

  @Get('users')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  listUsers() {
    return this.auth.listUsers();
  }
}
