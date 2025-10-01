import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appDataSource } from './typeorm.config';

@Module({
    // GraphQL-step 3 - Database Configuration in AppModule
    // Configure TypeORM connection with database credentials, entities array, and synchronize option
    // This establishes the connection between NestJS application and MySQL database
    imports: [TypeOrmModule.forRoot(appDataSource.options)],
})
export class TypeormModule {}
