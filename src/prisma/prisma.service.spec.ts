import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useFactory: () => new PrismaService('postgresql://localhost/test_db'),
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    service.$connect = jest.fn();
    service.$disconnect = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call $connect on onModuleInit', async () => {
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalled();
  });

  it('should call $disconnect on onModuleDestroy', async () => {
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalled();
  });
});
