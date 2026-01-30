import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserSettingService {
    constructor(private readonly prismaService: PrismaService) {}

    async getUserSettingById(userId: string) {
        const settings = await this.prismaService.userSettings.findUnique({
            where: { userId },
        });

        if (!settings) {
            throw new NotFoundException(`User settings not found`);
        }

        return settings;
    }

    async createUserSettings(data: Prisma.UserSettingsUncheckedCreateInput) {
        try {
            return await this.prismaService.userSettings.create({
                data,
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException('User settings already exist');
                }
            }
            throw error;
        }
    }
}
