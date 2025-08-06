import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserlDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export type User = {
    userId: string;
    username: string;
    password: string;
    email: string;
    roles: string[];
};

@Injectable()
export class UsersService {
    private readonly users: User[] = [
        {
            userId: randomUUID(), // Generate GUID,
            username: 'john',
            password: 'changeme',
            email: 'john@example.com',
            roles: ['user'],
        },
        {
            userId: randomUUID(), // Generate GUID,
            username: 'maria',
            password: 'guess',
            email: 'maria@example.com',
            roles: [],
        },
    ];

    constructor() {
        this.users = this.users.map(user => ({
            ...user,
            password: bcrypt.hashSync(user.password, 10),
        }));
    }

    async findOne(email: string): Promise<User | undefined> {
        return this.users.find(user => user.email === email);
    }

    findById(sub: any): User {
        return this.users.find(user => user.userId === sub);
    }

    create(createUserDto: CreateUserDto) {
        const user = {
            userId: randomUUID(),
            ...createUserDto,
        };
        this.users.push();
        return user;
    }

    findAll() {
        return this.users;
    }

    update(id: number, updateUserDto: UpdateUserlDto) {
        const updatedUser = {
            ...updateUserDto,
        };
        this.users.find(user => user.email === updatedUser.email);
        return `This action updates a #${id} user`;
    }

    remove(id: number) {
        return `This action removes a #${id} user`;
    }
}
