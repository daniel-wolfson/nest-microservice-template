import { Prisma } from '@prisma/client';

export type CreateUserData = Prisma.XOR<Prisma.UserCreateInput, Prisma.UserUncheckedCreateInput>;

export type UserWithRoles = Prisma.UserGetPayload<{
    include: { roles: { include: { role: true } } };
}>;

export type UserWithSettings = Prisma.UserGetPayload<{
    include: { settings: true };
}>;

export type UserFull = Prisma.UserGetPayload<{
    include: {
        settings: true;
        roles: { include: { role: true } };
    };
}>;
