import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserSettingService } from './user-settings.service';
import { UserResolver } from './user.resolver';

@Module({
    //imports: [TypeOrmModule.forFeature([User, UserSetting])],
    providers: [UserService, UserResolver, UserSettingService, UserResolver],
    exports: [UserService],
})
export class UserModule {}
