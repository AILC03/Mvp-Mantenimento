import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { hashPassword } from '../src/auth/password';

const ORIGIN = 'http://127.0.0.1:5173';
const accounts = [
  { username: 'mecanico.prueba.com', role: UserRole.LEAD_MECHANIC },
  { username: 'almacen.prueba.com', role: UserRole.WAREHOUSE_CLERK },
  { username: 'chofer01.prueba.com', role: UserRole.DRIVER },
  { username: 'admin.prueba.com', role: UserRole.ADMIN },
];

describe('Authentication HTTP', () => {
  let app: INestApplication<App>;
  let passwordHash: string;
  let users: {
    id: string;
    username: string;
    name: string;
    role: UserRole;
    passwordHash: string;
    isActive: boolean;
  }[];
  let sessions: { tokenHash: string; userId: string; expiresAt: Date }[];

  beforeAll(async () => {
    passwordHash = await hashPassword('PRUEBA123');
  });
  beforeEach(async () => {
    users = accounts.map((account, index) => ({
      ...account,
      id: String(index),
      name: account.username,
      passwordHash,
      isActive: true,
    }));
    sessions = [];
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { username: string } }) =>
          Promise.resolve(
            users.find((user) => user.username === where.username) ?? null,
          ),
        ),
        findMany: jest.fn(() =>
          Promise.resolve(
            users.map(({ id, username, name, role, isActive }) => ({
              id,
              username,
              name,
              role,
              isActive,
            })),
          ),
        ),
      },
      authSession: {
        create: jest.fn(({ data }: { data: (typeof sessions)[number] }) => {
          sessions.push(data);
          return Promise.resolve(data);
        }),
        findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) => {
          const session = sessions.find(
            (item) => item.tokenHash === where.tokenHash,
          );
          return Promise.resolve(
            session
              ? {
                  ...session,
                  user: users.find((user) => user.id === session.userId),
                }
              : null,
          );
        }),
        deleteMany: jest.fn(
          ({
            where,
          }: {
            where: { tokenHash?: string; expiresAt?: { lte: Date } };
          }) => {
            sessions = sessions.filter((item) =>
              where.tokenHash
                ? item.tokenHash !== where.tokenHash
                : item.expiresAt > where.expiresAt!.lte,
            );
            return Promise.resolve({ count: 0 });
          },
        ),
      },
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it.each(accounts)(
    'logs in $username with the assigned role and no credential leaks',
    async (account) => {
      const agent = request.agent(app.getHttpServer());
      const response = await agent
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({
          username: account.username,
          password: 'PRUEBA123',
          role: 'ADMIN',
        })
        .expect(200);
      expect(response.body as unknown).toEqual({
        user: expect.objectContaining({
          username: account.username,
          role: account.role,
        }) as unknown,
        expiresAt: expect.any(String) as unknown,
      });
      const serialized = JSON.stringify(response.body as unknown);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('PRUEBA123');
      expect(serialized).not.toContain('token');
      expect(String(response.headers['set-cookie'])).toMatch(/HttpOnly/i);
      expect(String(response.headers['set-cookie'])).toMatch(
        /SameSite=Strict/i,
      );
      expect(String(response.headers['set-cookie'])).not.toContain(
        sessions[0].tokenHash,
      );
      await agent.get('/api/auth/me').expect(200);
      await agent.post('/api/auth/logout').set('Origin', ORIGIN).expect(204);
      expect(sessions).toHaveLength(0);
      await agent.get('/api/auth/me').expect(401);
    },
  );

  it('requires authentication and limits user listing to admin', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/auth/users').expect(401);
    const driver = request.agent(app.getHttpServer());
    await driver
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ username: accounts[2].username, password: 'PRUEBA123' })
      .expect(200);
    await driver.get('/api/auth/users').expect(403);
    const admin = request.agent(app.getHttpServer());
    await admin
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ username: accounts[3].username, password: 'PRUEBA123' })
      .expect(200);
    const response = await admin.get('/api/auth/users').expect(200);
    expect(JSON.stringify(response.body as unknown)).not.toContain(
      'passwordHash',
    );
    expect(response.body as unknown[]).toHaveLength(4);
  });

  it('rejects wrong passwords, missing accounts, inactive users and expired sessions', async () => {
    for (const username of [accounts[0].username, 'no-existe.prueba.com']) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ username, password: 'incorrecta' })
        .expect(401);
      expect(response.body as unknown).toEqual(
        expect.objectContaining({
          message: 'Usuario o contraseña incorrectos.',
        }),
      );
    }
    users[0].isActive = false;
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ username: accounts[0].username, password: 'PRUEBA123' })
      .expect(401);
    users[0].isActive = true;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ username: accounts[0].username, password: 'PRUEBA123' })
      .expect(200);
    sessions[0].expiresAt = new Date(Date.now() - 1000);
    await agent.get('/api/auth/me').expect(401);
  });

  it('blocks foreign origins and malformed bodies', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'https://invalid.example')
      .send({ username: accounts[0].username, password: 'PRUEBA123' })
      .expect(403);
    await request(app.getHttpServer()).post('/api/auth/logout').expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({
        username: { value: accounts[0].username },
        password: 'PRUEBA123',
      })
      .expect(400);
  });

  it('limits login attempts by IP', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({})
        .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({})
      .expect(429);
  });
});
