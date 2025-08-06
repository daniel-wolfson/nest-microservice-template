import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from '@lib/entities';
import { ConfigService } from '@nestjs/config';

const environment = process.env.NODE_ENV || 'development';
config({ path: join(process.cwd(), `.env.${environment}`) });
Logger.log(process.cwd() + process.env.DATABASE_URL);

const options = (): DataSourceOptions => {
    const configService = new ConfigService();
    const url = configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!url) {
        Logger.error('DATABASE_URL not setted', 'PROVIDERS [TypeOrm]');
        return;
        // throw new Error('DATABASE_URL not setted');
    }
    return {
        type: 'postgres',
        url,
        schema: 'public',
        entities: ENTITIES,
        name: 'appDataSource',
        //migrations: [join(__dirname, '../migrations/*.{ts,js}')],
        //migrationsTableName: 'migrations',
        //migrationsRun: true,
        synchronize: true, // Set to false in production
        logging: ['error', 'warn'], // Adjust logging level as needed
        extra: {
            connectionLimit: 10,
        },
    };
};

export const appDataSource = new DataSource(options());
