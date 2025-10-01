import { Module } from '@nestjs/common';
// Step 11 - Create Feature Module
// Organize code into feature modules using @Module decorator
// Import TypeORM entities and declare all providers (resolvers, services)
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../graphql/models/user';
import { UserService } from './user.service';
import { UserSettingService } from './user-settings.service';
import { UserSetting } from '../graphql/models/user-setting';
import { UserResolver } from './user.resolver';

@Module({
    // GraphQL-step 11 - Import TypeORM entities with TypeOrmModule.forFeature()
    imports: [TypeOrmModule.forFeature([User, UserSetting])],
    // GraphQL-step 11 - Declare all providers (resolvers, services) for dependency injection
    providers: [UserService, UserResolver, UserSettingService, UserResolver],
    exports: [UserService],
})
export class UserModule {}
