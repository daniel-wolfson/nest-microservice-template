// GraphQL-step 8 - Implement Service Layer
// UserSettingService handles business logic for user settings operations
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../graphql/models/user';
import { UserSetting } from '../graphql/models/user-setting';
import { CreateUserSettingsInput } from '../graphql/utils/CreateUserSettingsInput';
import { Repository } from 'typeorm';

@Injectable() // GraphQL-step 8 - NestJS service decorator
export class UserSettingService {
    constructor(
        // GraphQL-step 8 - Inject multiple repositories for complex business logic
        @InjectRepository(UserSetting)
        private userSettingsRepository: Repository<UserSetting>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    // GraphQL-step 8 - Method to retrieve user settings by user ID
    getUserSettingById(userId: number) {
        return this.userSettingsRepository.findOneBy({ userId });
    }

    // GraphQL-step 8 - Complex business logic method that involves multiple entities
    // GraphQL-step 18 - Error Handling and Validation (includes error handling)
    async createUserSettings(createUserSettingsData: CreateUserSettingsInput) {
        const findUser = await this.userRepository.findOneBy({
            id: createUserSettingsData.userId,
        });

        if (!findUser) throw new Error('User Not Found'); // GraphQL-step 18 - Error handling

        const newUserSetting = this.userSettingsRepository.create(createUserSettingsData);
        const savedSettings = await this.userSettingsRepository.save(newUserSetting);

        // GraphQL-step 17 - Database Relationship Configuration (updating relationship)
        findUser.settings = savedSettings;
        await this.userRepository.save(findUser);

        return savedSettings;
    }
}
