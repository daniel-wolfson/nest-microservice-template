// GraphQL-step 7 - Create GraphQL Input Types
// Implement input classes with @InputType and @Field decorators for mutations
// Input types define the structure of data that clients send when creating or updating resources
import { InputType, Field } from '@nestjs/graphql';

@InputType() // GraphQL-step 7 - GraphQL input type decorator
export class CreateUserInput {
  @Field() // GraphQL-step 7 - Required field for username
  username: string;

  @Field({ nullable: true }) // GraphQL-step 7 - Optional field for display name
  displayName?: string;
}
