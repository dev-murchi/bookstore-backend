import {
  Module,
  DynamicModule,
  Global,
  Provider,
  ModuleMetadata,
  InjectionToken,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

interface PrismaModuleOptions {
  dbUrl: string;
}

interface PrismaModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: InjectionToken[];
  useFactory: (...args: unknown[]) => Promise<PrismaModuleOptions> | PrismaModuleOptions;
}

@Global()
@Module({})
export class PrismaModule {
  static forRoot(dbUrl: string): DynamicModule {
    if (!dbUrl.trim()) {
      throw new Error('PrismaModule.forRoot: database url must be provided!');
    }

    const prismaProvider: Provider = {
      provide: PrismaService,
      useFactory: () => new PrismaService(dbUrl),
    };

    return {
      module: PrismaModule,
      providers: [prismaProvider],
      exports: [PrismaService],
    };
  }

  static forRootAsync(options: PrismaModuleAsyncOptions): DynamicModule {
    if (!options) {
      throw new Error('PrismaModule.forRootAsync: options must be provided!');
    }

    const prismaProvider: Provider = {
      provide: PrismaService,
      inject: options.inject ?? [],
      useFactory: async (...args: unknown[]) => {
        const prismaOptions = await options.useFactory(...args);
        if (!prismaOptions.dbUrl) {
          throw new Error('PrismaModule.forRootAsync: dbUrl must be provided!');
        }
        return new PrismaService(prismaOptions.dbUrl);
      },
    };

    return {
      module: PrismaModule,
      imports: options.imports ?? [],
      providers: [prismaProvider],
      exports: [PrismaService],
    };
  }
}
