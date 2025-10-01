// GraphQL-step 9 - Build GraphQL Resolvers
// UserSettingsResolver handles GraphQL operations for user settings
import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UserSetting } from '../models/user-setting';
import { CreateUserSettingsInput } from '../utils/CreateUserSettingsInput';
import { mockUserSettings } from '../../../__mocks__/mockUserSettings';
import { UserSettingService } from '../../users/user-settings.service';

@Resolver() // GraphQL-step 9 - GraphQL resolver decorator (generic resolver)
export class UserSettingsResolver {
    constructor(private userSettingsService: UserSettingService) {} // GraphQL-step 9 - Inject service

    // GraphQL-step 9 - Mutation method with @Mutation decorator
    // GraphQL-step 10 - @Args decorator for parameter mapping
    @Mutation(returns => UserSetting)
    async createUserSettings(
        @Args('createUserSettingsData')
        createUserSettingsData: CreateUserSettingsInput,
    ) {
        const userSetting = await this.userSettingsService.createUserSettings(createUserSettingsData);
        return userSetting;
    }
}
