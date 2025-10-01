// GraphQL-step 5 & 6 - Create TypeORM Entity Models + Add GraphQL Object Type Decorators
// UserSetting entity with both TypeORM and GraphQL decorators for database and API integration
import { PrimaryColumn, Column, Entity } from 'typeorm';
import { ObjectType, Field, Int } from '@nestjs/graphql';

@Entity({ name: 'user_settings' }) // GraphQL-step 5 - TypeORM entity decorator
@ObjectType() // GraphQL-step 6 - GraphQL object type decorator
export class UserSetting {
  @PrimaryColumn() // GraphQL-step 5 - TypeORM primary column
  @Field((type) => Int) // GraphQL-step 6 - GraphQL field decorator
  userId: number;

  @Column({ default: false }) // GraphQL-step 5 - TypeORM column with default value
  @Field({ defaultValue: false }) // GraphQL-step 6 - GraphQL field with default value
  receiveNotifications: boolean;

  @Column({ default: false }) // GraphQL-step 5 - TypeORM column with default value
  @Field({ defaultValue: false }) // GraphQL-step 6 - GraphQL field with default value
  receiveEmails: boolean;
}
