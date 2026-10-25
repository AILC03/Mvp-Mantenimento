import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password';
import { SESSION_DURATION_MS, type PublicUser } from './auth.types';

const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const publicFields = {
  id: true,
  username: true,
  name: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(
    body: unknown,
  ): Promise<{ token: string; user: PublicUser; expiresAt: Date }> {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Usuario y contraseña son obligatorios.');
    const input = body as Record<string, unknown>;
    if (
      typeof input.username !== 'string' ||
      typeof input.password !== 'string' ||
      input.password.length < 1 ||
      input.password.length > 128
    )
      throw new BadRequestException(
        'Usuario y contraseña son obligatorios (contraseña de hasta 128 caracteres).',
      );
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username))
      throw new BadRequestException(
        'El nombre de usuario no tiene un formato válido.',
      );
    const user = await this.prisma.user.findUnique({ where: { username } });
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !user.isActive || !valid)
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.prisma.authSession.create({
      data: { tokenHash: digest(token), userId: user.id, expiresAt },
    });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      expiresAt,
    };
  }

  async authenticate(
    token?: string,
  ): Promise<{ user: PublicUser; expiresAt: Date }> {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Inicia sesión para continuar.');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive
    )
      throw new UnauthorizedException(
        'La sesión no está disponible o ha expirado.',
      );
    const { id, username, name, role } = session.user;
    return { user: { id, username, name, role }, expiresAt: session.expiresAt };
  }

  async logout(token?: string): Promise<void> {
    if (token)
      await this.prisma.authSession.deleteMany({
        where: { tokenHash: digest(token) },
      });
  }

  listUsers() {
    return this.prisma.user.findMany({
      select: { ...publicFields, isActive: true, createdAt: true },
      orderBy: { username: 'asc' },
    });
  }
}
