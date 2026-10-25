import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/auth/auth.guard';
import { OperationsService } from '../src/operations/operations.service';
import { PrismaService } from '../src/database/prisma.service';

describe('Compatibilidad de API de unidades tras migración', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(OperationsService)
      .useValue({
        snapshot: () => ({
          catalogs: {
            vehicles: [{ id: 'legacy-unit', fleetNumber: 'BUS-001' }],
          },
          revision: 5,
        }),
      })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { auth: unknown } };
        }) => {
          context.switchToHttp().getRequest().auth = {
            user: { id: 'admin', role: 'ADMIN' },
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('lee la misma fuente operativa', async () => {
    await request(app.getHttpServer())
      .get('/api/vehicles')
      .expect(200)
      .expect({
        vehicles: [{ id: 'legacy-unit', fleetNumber: 'BUS-001' }],
        revision: 5,
      });
  });
  it('rechaza escrituras antiguas para no crear una segunda fuente de verdad', async () => {
    await request(app.getHttpServer())
      .post('/api/vehicles')
      .send({})
      .expect(410);
    await request(app.getHttpServer())
      .put('/api/vehicles/legacy-unit')
      .send({})
      .expect(410);
  });
});
