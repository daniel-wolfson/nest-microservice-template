// GraphQL-step 8 - Implement Service Layer
// Create service classes with @Injectable decorators and inject TypeORM repositories
// Services contain business logic and data access methods, following separation of concerns
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../graphql/models/user';
import { CreateUserInput } from '../graphql/utils/CreateUserInput';

@Injectable() // GraphQL-step 8 - NestJS service decorator for dependency injection
export class UserService {
    constructor(
        // GraphQL-step 8 - Inject TypeORM repository using @InjectRepository decorator
        @InjectRepository(User) private usersRepository: Repository<User>,
    ) {}

    // GraphQL-step 8 - Business logic method to get all users with their settings
    getUsers() {
        return this.usersRepository.find({ relations: ['settings'] });
    }

    // GraphQL-step 8 - Business logic method to get user by ID with settings
    getUserById(id: number) {
        return this.usersRepository.findOne({
            where: { id },
            relations: ['settings'],
        });
    }

    // GraphQL-step 8 - Business logic method to create a new user
    createUser(createUserData: CreateUserInput) {
        const newUser = this.usersRepository.create(createUserData);
        return this.usersRepository.save(newUser);
    }
}
