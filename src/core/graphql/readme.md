# NestJS + GraphQL + TypeORM + SQL Implementation Guide

This repository demonstrates a complete implementation of a GraphQL API using NestJS, TypeORM, and MySQL. This README documents every step of the implementation process from project setup to production-ready configuration.

## 📋 Complete Implementation Steps

### GraphQL-step 1: Project Setup and Dependencies ✅

**What was done:** Installed and configured all necessary packages for NestJS + GraphQL + TypeORM integration.

**Key Dependencies:**

-   `@nestjs/graphql` - NestJS GraphQL integration
-   `@nestjs/apollo` - Apollo Server integration for NestJS
-   `@apollo/server` - Apollo Server v4
-   `graphql` - GraphQL implementation
-   `typeorm` - Object-Relational Mapping
-   `@nestjs/typeorm` - NestJS TypeORM integration
-   `mysql2` - MySQL database driver

**Files affected:** `package.json`

### GraphQL-step 2: Configure TypeScript and Build Setup ✅

**What was done:** Set up TypeScript configuration with proper settings for NestJS decorators and GraphQL schema generation.

-   tsconfig.json -> "compilerOptions"
-   nest-cli.json -> "$schema"
-   tsconfig.build.json -> "extends"

**Key configurations:**

-   `experimentalDecorators: true` - Required for NestJS decorators
-   `emitDecoratorMetadata: true` - Required for dependency injection
-   Configured build scripts and linting

**Files affected:** `tsconfig.json`, `nest-cli.json`

### GraphQL-step 3: Database Configuration in AppModule ✅

**What was done:** Configured TypeORM connection in the main application module.

```typescript
TypeOrmModule.forRoot({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'testuser',
    password: 'testuser123',
    database: 'graphql_tutorial',
    entities: [User, UserSetting],
    synchronize: true,
    logging: false,
});
```

**Files affected:** `src/app.module.ts`

### GraphQL-step 4: GraphQL Module Configuration ✅

**What was done:** Set up GraphQL module with Apollo Server and automatic schema generation.

```typescript
GraphQLModule.forRoot<ApolloDriverConfig>({
    driver: ApolloDriver,
    autoSchemaFile: 'src/schema.gql',
});
```

**Features enabled:**

-   Automatic GraphQL schema generation from TypeScript classes
-   GraphQL Playground for development
-   Apollo Server integration

**Files affected:** `src/app.module.ts`

### GraphQL-step 5: Create TypeORM Entity Models ✅

**What was done:** Designed and implemented database entity classes using TypeORM decorators.

**Entity Models Created:**

-   `User` entity with id, username, displayName fields
-   `UserSetting` entity with userId, receiveNotifications, receiveEmails fields
-   Defined proper column types and constraints

```typescript
@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    username: string;

    @Column({ nullable: true })
    displayName?: string;
}
```

**Files affected:** `src/graphql/models/User.ts`, `src/graphql/models/UserSetting.ts`

### GraphQL-step 6: Add GraphQL Object Type Decorators ✅

**What was done:** Enhanced entity models with GraphQL decorators to make them available in GraphQL schema.

**GraphQL Decorators Added:**

-   `@ObjectType()` - Marks class as GraphQL object type
-   `@Field()` - Marks properties as GraphQL fields
-   `@Field(() => Int)` - Specifies field types

```typescript
@ObjectType()
export class User {
    @Field(type => Int)
    id: number;

    @Field()
    username: string;

    @Field({ nullable: true })
    displayName?: string;
}
```

**Files affected:** `src/graphql/models/User.ts`, `src/graphql/models/UserSetting.ts`

### GraphQL-step 7: Create GraphQL Input Types ✅

**What was done:** Implemented input classes for GraphQL mutations with proper validation.

**Input Types Created:**

-   `CreateUserInput` - For user creation mutations
-   `CreateUserSettingsInput` - For user settings creation mutations

```typescript
@InputType()
export class CreateUserInput {
    @Field()
    username: string;

    @Field({ nullable: true })
    displayName?: string;
}
```

**Files affected:** `src/graphql/utils/CreateUserInput.ts`, `src/graphql/utils/CreateUserSettingsInput.ts`

### GraphQL-step 8: Implement Service Layer ✅

**What was done:** Created service classes with business logic and data access methods.

**Services Implemented:**

-   `UserService` - Handles user-related business logic
-   `UserSettingService` - Handles user settings operations

**Key Features:**

-   Dependency injection with `@Injectable()`
-   Repository injection with `@InjectRepository()`
-   Business logic separation from resolvers

```typescript
@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private usersRepository: Repository<User>) {}

    getUsers() {
        return this.usersRepository.find({ relations: ['settings'] });
    }
}
```

**Files affected:** `src/users/UserService.ts`, `src/users/UserSettingService.ts`

### GraphQL-step 9: Build GraphQL Resolvers ✅

**What was done:** Implemented resolver classes to handle GraphQL queries and mutations.

**Resolvers Created:**

-   `UserResolver` - Handles user queries and mutations
-   `UserSettingsResolver` - Handles user settings mutations

**GraphQL Operations:**

-   `getUsers` - Query to fetch all users
-   `getUserById` - Query to fetch user by ID
-   `createUser` - Mutation to create new user
-   `createUserSettings` - Mutation to create user settings

```typescript
@Resolver(of => User)
export class UserResolver {
    @Query(() => [User])
    getUsers() {
        return this.userService.getUsers();
    }

    @Mutation(returns => User)
    createUser(@Args('createUserData') createUserData: CreateUserInput) {
        return this.userService.createUser(createUserData);
    }
}
```

**Files affected:** `src/users/UserResolver.ts`, `src/graphql/resolvers/UserSettingsResolver.ts`

### GraphQL-step 10: Configure Resolver Field Mapping ✅

**What was done:** Configured proper parameter mapping between GraphQL arguments and TypeScript methods.

**Key Decorators Used:**

-   `@Args()` - Maps GraphQL arguments to method parameters
-   `@Query()` - Defines GraphQL query operations
-   `@Mutation()` - Defines GraphQL mutation operations

**Files affected:** All resolver files

### GraphQL-step 11: Create Feature Module ✅

**What was done:** Organized code into a feature module for better structure and encapsulation.

```typescript
@Module({
    imports: [TypeOrmModule.forFeature([User, UserSetting])],
    providers: [UserResolver, UserService, UserSettingService, UserSettingsResolver],
})
export class UsersModule {}
```

**Files affected:** `src/users/users.module.ts`

### GraphQL-step 12: Register Module in AppModule ✅

**What was done:** Imported the feature module into the main application module.

**Files affected:** `src/app.module.ts`

### GraphQL-step 13: Configure Application Bootstrap ✅

**What was done:** Set up the main application entry point with proper server configuration.

```typescript
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
}
```

**Files affected:** `src/main.ts`

### GraphQL-step 14: Schema Generation and Validation ✅

**What was done:** Automatic GraphQL schema generation from decorated TypeScript classes.

**Generated Schema Features:**

-   Type definitions for User and UserSetting
-   Query operations (getUsers, getUserById)
-   Mutation operations (createUser, createUserSettings)
-   Input type definitions

**Files affected:** `src/schema.gql` (auto-generated)

### SGraphQL-step 15: Create GraphQL Queries for Testing ✅

**What was done:** Created example GraphQL operations for testing and client reference.

```typescript
export const createUserMutation = gql`
    mutation {
        createUser(createUserData: { username: "testuser", displayName: "testuser" }) {
            id
            username
            displayName
        }
    }
`;
```

**Files affected:** `src/utils/queries.ts`

### GraphQL-step 16: Implement End-to-End Tests ✅

**What was done:** Created comprehensive e2e test suite to verify GraphQL operations.

**Test Coverage:**

-   GraphQL server setup and teardown
-   Database synchronization for testing
-   Query operations testing
-   Mutation operations testing
-   Response validation

**Files affected:** `test/app.e2e-spec.ts`

### GraphQL-step 17: Database Relationship Configuration ✅

**What was done:** Implemented proper TypeORM relationships between entities.

**Relationships Configured:**

-   One-to-One relationship between User and UserSetting
-   Proper join column configuration
-   Cascade operations setup

```typescript
@OneToOne(() => UserSetting)
@JoinColumn()
@Field({ nullable: true })
settings?: UserSetting;
```

**Files affected:** `src/graphql/models/User.ts`

### GraphQL-step 18: Error Handling and Validation ✅

**What was done:** Added proper error handling in services and resolvers.

**Error Handling Features:**

-   Service-level error handling
-   Validation for user existence
-   Meaningful error messages

**Files affected:** Service files

### GraphQL-step 19: GraphQL Playground Setup ✅

**What was done:** GraphQL Playground is automatically available for interactive testing.

**Access:** `http://localhost:3000/graphql`

**Features Available:**

-   Interactive query/mutation testing
-   Schema exploration
-   Real-time query validation
-   Documentation browser

### GraphQL-step 20: Production Optimizations 🔄

**What needs to be done:** Configure production settings and optimizations.

**Recommended Optimizations:**

-   Disable GraphQL Playground in production
-   Implement authentication/authorization
-   Add request/response logging
-   Implement caching strategies
-   Database query optimization
-   Error handling improvements
-   Security middleware

## 🚀 Getting Started

1. **Install Dependencies:**

    ```bash
    npm install
    ```

2. **Set up MySQL Database:**

    - Create database: `graphql_tutorial`
    - Update credentials in `src/app.module.ts`

3. **Run the Application:**

    ```bash
    npm run start:dev
    ```

4. **Access GraphQL Playground:**

    - Open: `http://localhost:3000/graphql`

5. **Run Tests:**
    ```bash
    npm run test:e2e
    ```

## 📊 Project Structure

```
src/
├── app.module.ts              # GraphQL-step 3, 4, 12 - Main app configuration
├── main.ts                    # GraphQL-step 13 - Application bootstrap
├── schema.gql                 # GraphQL-step 14 - Auto-generated GraphQL schema
├── graphql/
│   ├── models/
│   │   ├── User.ts           # GraphQL-step 5, 6, 17 - User entity model
│   │   └── UserSetting.ts    # GraphQL-step 5, 6 - UserSetting entity model
│   ├── resolvers/
│   │   └── UserSettingsResolver.ts # GraphQL-step 9, 10 - GraphQL resolver
│   └── utils/
│       ├── CreateUserInput.ts      # GraphQL-step 7 - Input type
│       └── CreateUserSettingsInput.ts # GraphQL-step 7 - Input type
├── users/
│   ├── users.module.ts        # GraphQL-step 11 - Feature module
│   ├── UserResolver.ts        # GraphQL-step 9, 10 - User resolver
│   ├── UserService.ts         # GraphQL-step 8 - User service
│   └── UserSettingService.ts  # GraphQL-step 8 - UserSetting service
└── utils/
    └── queries.ts             # GraphQL-step 15 - Test queries
```

## 🎯 GraphQL API Operations

### Queries

-   `getUsers` - Fetch all users with their settings
-   `getUserById(id: Int!)` - Fetch specific user by ID

### Mutations

-   `createUser(createUserData: CreateUserInput!)` - Create new user
-   `createUserSettings(createUserSettingsData: CreateUserSettingsInput!)` - Create user settings

## 🔗 Resources

-   [NestJS Documentation](https://docs.nestjs.com/)
-   [GraphQL Documentation](https://graphql.org/)
-   [TypeORM Documentation](https://typeorm.io/)
-   [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)

## 📽️ Video Tutorial

Check out the video tutorial [here](https://www.youtube.com/watch?v=CSfZmyzQAG8&).
[![NestJS GraphQL with TypeORM & SQL](https://github.com/stuyy/nestjs-graphql-typeorm/assets/25330491/935f8740-2f1b-4cc6-9275-5c62cf63ceb7)](https://www.youtube.com/watch?v=CSfZmyzQAG8&)
