import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AppConfigModule } from '../app-config/app-config.module';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../app-config/app-config.service';
import { LanguageService } from '@/core/services/language.service';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './services/authentication.service';
import { TokenService } from './services/token.service';
import { LocalStrategy } from './services/local.strategy';
import { JwtStrategy } from './services/jwt.strategy';

@Module({
    imports: [
        AppConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            useFactory: async (appConfigService: AppConfigService) => ({
                secret: appConfigService.jwtAccessSecret,
                signOptions: {
                    expiresIn: appConfigService.jwtAccessExpiresIn,
                },
            }),
            inject: [AppConfigService],
            imports: [AppConfigModule],
        }),
    ],
    providers: [JwtService, TokenService, LanguageService, LocalStrategy, JwtStrategy, AuthenticationService],
    controllers: [AuthenticationController],
})
export class AuthenticationModule {}
