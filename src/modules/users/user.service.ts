import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { Prisma } from '@prisma/client';
import { validate as isUUID } from 'uuid';

@Injectable()
export class UserService {
    constructor(private prismaService: PrismaService) {}

    getUsers() {
        return this.prismaService.user.findMany({ include: { settings: true, roles: { include: { role: true } } } });
    }

    getUserById(
        id: string,
    ): Promise<Prisma.UserGetPayload<{ include: { settings: true; roles: { include: { role: true } } } }> | null> {
        return this.prismaService.user.findUnique({
            where: { id },
            include: { settings: true, roles: { include: { role: true } } },
        });
    }

    createUser(data: Prisma.UserUncheckedCreateInput) {
        if (data.id && !isUUID(data.id)) {
            throw new BadRequestException('Invalid UUID format for user id');
        }
        return this.prismaService.user.create({ data });
    }

    updateUser(
        id: string,
        data: Prisma.UserUpdateInput,
    ): Promise<Prisma.UserGetPayload<{ include: { settings: true; roles: { include: { role: true } } } }>> {
        {
            if (data.id && !isUUID(data.id)) {
                throw new BadRequestException('Invalid UUID format for user id');
            }
            return this.prismaService.user.update({
                where: { id },
                data,
                include: { settings: true, roles: { include: { role: true } } },
            });
        }
    }
}
