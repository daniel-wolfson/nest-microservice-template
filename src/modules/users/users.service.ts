import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserlDto } from './dto/update-user.dto';

// This should be a real class/interface representing a user entity
export type User = {
    userId: number;
    username: string;
    password: string;
    email: string;
};

@Injectable()
export class UsersService {
    private readonly users = [
        {
            userId: 1,
            username: 'john',
            password: 'changeme',
            email: 'john@example.com',
        },
        {
            userId: 2,
            username: 'maria',
            password: 'guess',
            email: 'maria@example.com',
        },
    ];

    async findOne(username: string): Promise<User | undefined> {
        return this.users.find(user => user.username === username);
    }

    create(createUserDto: CreateUserDto) {
        const user = {
            userId: this.users.length + 1,
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
