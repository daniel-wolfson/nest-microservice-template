import { CreateUserSettingsDto } from '@/modules/users/dto/create-userSettings.dto';
import { PrismaService } from 'nestjs-prisma';

export class UserSettingsResolver {
    constructor(private readonly prismaService: PrismaService) {}

    async createUserSettings(createUserSettingsDto: CreateUserSettingsDto) {
        const userSetting = await this.prismaService.user.create({ data: createUserSettingsDto as any });
        return userSetting;
    }
}
