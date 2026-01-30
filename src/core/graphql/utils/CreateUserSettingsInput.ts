// GraphQL-step 7 - Create GraphQL Input Types
// Input type for creating user settings with validation and default values
import { InputType, Field, Int } from '@nestjs/graphql';

@InputType() // GraphQL-step 7 - GraphQL input type decorator
export class CreateUserSettingsInput {
  @Field((type) => Int) // GraphQL-step 7 - Integer field for user ID
  userId: number;

  @Field({ nullable: true, defaultValue: false }) // GraphQL-step 7 - Optional boolean with default
  receiveNotifications: boolean;

  @Field({ nullable: true, defaultValue: false }) // GraphQL-step 7 - Optional boolean with default
  receiveEmails: boolean;
}
