// GraphQL-step 9 - Build GraphQL Resolvers
// GraphQL-step 10 - Configure Resolver Field Mapping
// Implement resolver classes with @Resolver decorators and GraphQL operation methods
import { Resolver, Query, Args, Int, ResolveField, Parent, Mutation } from '@nestjs/graphql';
import { User } from '@/core/graphql/models/user';
//import { CreateUserInput } from '../graphql/utils/CreateUserInput';
import { UserService } from './user.service';
import { UserSettingService } from './user-settings.service';
import { CreateUserDto } from './dto/create-user.dto';

export let incrementalId = 3;

@Resolver(of => User) // GraphQL-step 9 - GraphQL resolver decorator for User type
export class UserResolver {
    constructor(
        // GraphQL-step 9 - Inject services for business logic
        private userService: UserService,
        private userSettingService: UserSettingService,
    ) {}

    @Query(() => User, { nullable: true })
    getUserById(@Args('id', { type: () => String }) id: string) {
        return this.userService.getUserById(id);
    }

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
    createUser(@Args('createUserData') createUserData: CreateUserDto) {
        return this.userService.createUser(createUserData);
    }
}
