import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaServiceOptions } from './prisma.options';
import { PRISMA_SERVICE_OPTIONS } from './prisma.constants';
import prismaConfig from '../../../prisma.config';

@Injectable()
export class PrismaService
    extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'>
    implements OnModuleInit, OnModuleDestroy
{
    private readonly pool?: Pool;

    constructor(
        @Optional()
        @Inject(PRISMA_SERVICE_OPTIONS)
        private readonly prismaServiceOptions: PrismaServiceOptions = {},
    ) {
        const prismaOptions: Prisma.PrismaClientOptions = prismaServiceOptions.prismaOptions ?? {};

        let pool: Pool | undefined;

        if (!prismaOptions.adapter) {
            const connectionString = (prismaConfig as any)?.datasource?.url ?? process.env.DATABASE_URL;

            if (!connectionString) {
                throw new Error('DATABASE_URL is required to initialize PrismaClient');
            }

            pool = new Pool({ connectionString });
            prismaOptions.adapter = new PrismaPg(pool);
        }

        super(prismaOptions);
        this.pool = pool;
    }

    async onModuleInit() {
        if (this.prismaServiceOptions.explicitConnect) {
            await this.$connect();
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool?.end();
    }
}
