import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from 'nestjs-prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AmqpModule } from './amqp';
import { TypeormModule } from './typeorm';

@Module({
    imports: [
        PrismaModule.forRootAsync({
            isGlobal: true,
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const databaseUrl = configService.get<string>('DATABASE_URL');

                const pool = new Pool({ connectionString: databaseUrl });
                const adapter = new PrismaPg(pool);

                return {
                    prismaOptions: {
                        adapter,
                    },
                    explicitConnect: true,
                };
            },
            inject: [ConfigService],
        }),
        TypeormModule,
        AmqpModule,
    ],
    exports: [TypeormModule], // Export TypeormModule to make DataSource available
})
export class ProvidersModule {}
