import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appDataSource } from './typeorm.config';

@Module({
    // Configure TypeORM connection with database credentials, entities array, and synchronize option
    // This establishes the connection between NestJS application and MySQL database
    //imports: [TypeOrmModule.forRoot(appDataSource.options)],
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                url: configService.get<string>('DATABASE_URL'),
                schema: 'public',
                //entities: [...ENTITIES, User, UserSetting],
                synchronize: configService.get('NODE_ENV') !== 'production',
                logging: ['error', 'warn'],
            }),
        }),
    ],
    exports: [TypeOrmModule], // Export
})
export class TypeormModule {}
