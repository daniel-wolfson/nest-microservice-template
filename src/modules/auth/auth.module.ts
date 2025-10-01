import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ValidationService } from './validation.service';
import { LocalStrategy } from './local.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { LoginController } from 'src/modules/auth/login.controller';
import { ConfigModule } from '@nestjs/config';
import { JwtConfigFactory } from './jwt.factory';
import { UsersService } from '../users/user.service.old';

@Module({
    imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'local' }), // Add default strategy
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useClass: JwtConfigFactory,
        }),
    ],
    providers: [UsersService, AuthService, ValidationService, JwtConfigFactory, LocalStrategy, JwtStrategy],
    controllers: [LoginController],
    exports: [AuthService, ValidationService],
})
export class AuthModule {}
