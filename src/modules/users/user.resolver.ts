// GraphQL-step 9 - Build GraphQL Resolvers
// GraphQL-step 10 - Configure Resolver Field Mapping
// Implement resolver classes with @Resolver decorators and GraphQL operation methods
import { Resolver, Query, Args, Int, ResolveField, Parent, Mutation } from '@nestjs/graphql';
import { User } from '../graphql/models/user';
import { CreateUserInput } from '../graphql/utils/CreateUserInput';
import { UserService } from './user.service';
import { UserSettingService } from './user-settings.service';

export let incrementalId = 3;

@Resolver(of => User) // GraphQL-step 9 - GraphQL resolver decorator for User type
export class UserResolver {
    constructor(
        // GraphQL-step 9 - Inject services for business logic
        private userService: UserService,
        private userSettingService: UserSettingService,
    ) {}

    // GraphQL-step 9 - Query method with @Query decorator
    // GraphQL-step 10 - Use @Args decorator for parameter mapping
    @Query(returns => User, { nullable: true })
    getUserById(@Args('id', { type: () => Int }) id: number) {
        return this.userService.getUserById(id);
    }

    // GraphQL-step 9 - Query method returning array of users
    @Query(() => [User])
    getUsers() {
        return this.userService.getUsers();
    }

    // GraphQL-step 10 - @ResolveField for complex field resolution (commented out as relationship is handled automatically)
    // @ResolveField((returns) => UserSetting, { name: 'settings', nullable: true })
    // getUserSettings(@Parent() user: User) {
    //   return this.userSettingService.getUserSettingById(user.id);
    // }

    // GraphQL-step 9 - Mutation method with @Mutation decorator
    // GraphQL-step 10 - @Args decorator maps GraphQL arguments to TypeScript parameters
    @Mutation(returns => User)
    createUser(@Args('createUserData') createUserData: CreateUserInput) {
        return this.userService.createUser(createUserData);
    }
}
