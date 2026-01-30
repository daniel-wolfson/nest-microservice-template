import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Prisma, User } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UserWithRoles } from './user.type';

@Injectable()
export class UsersService {
    private readonly users: UserWithRoles[] = [
        {
            id: randomUUID().toString(), // Generate GUID,
            name: 'john',
            password: 'change_me',
            email: 'john@example.com',
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [],
        },
        {
            id: randomUUID(), // Generate GUID,
            name: 'maria',
            password: 'guess',
            email: 'maria@example.com',
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [],
        },
    ];

    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {
        this.users = this.users.map(user => ({
            ...user,
            password: bcrypt.hashSync(user.password, 10),
        }));
    }

    async findOne(email: string): Promise<UserWithRoles | undefined> {
        return this.users.find(user => user.email === email);
    }

    findById(sub: any): UserWithRoles {
        return this.users.find(user => user.id === sub);
    }

    create(createUserDto: CreateUserDto) {
        let user = undefined;
        try {
            user = {
                userId: randomUUID(),
                ...createUserDto,
            };
            this.users.push();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            const errStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error occurred: ${errMsg}`, { stack: errStack });
            throw new Error(`Failed to create user: ${errMsg}`);
        }
        return user;
    }

    findAll() {
        return this.users;
    }

    update(id: number, updateUserDto: UpdateUserDto) {
        try {
            const updatedUser = {
                ...updateUserDto,
            };
            this.users.find(user => user.email === updatedUser.email);
            // TODO: Implement actual update logic
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            const errStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error occurred: ${errMsg}`, { stack: errStack });
            throw new Error(`This action updates a #${id} user: ${errMsg}`);
        }
    }

    remove(id: number) {
        return `This action removes a #${id} user`;
    }
}
