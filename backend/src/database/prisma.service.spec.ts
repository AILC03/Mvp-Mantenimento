import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('requires DATABASE_URL', () => {
    const config = new ConfigService({});
    config.skipProcessEnv = true;
    expect(() => new PrismaService(config)).toThrow();
  });

  it('connects and disconnects with the module lifecycle', async () => {
    const service = new PrismaService(
      new ConfigService({
        DATABASE_URL: 'postgresql://test:test@localhost:5433/test',
      }),
    );
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
