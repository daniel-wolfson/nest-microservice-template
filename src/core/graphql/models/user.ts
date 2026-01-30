// GraphQL-step 5 & 6 - Create TypeORM Entity Models + Add GraphQL Object Type Decorators
// Design database entity classes using TypeORM decorators (@Entity, @Column, @PrimaryGeneratedColumn)
// Enhanced with GraphQL decorators (@ObjectType, @Field, @Int) to make them available in GraphQL schema
// This dual decoration allows the same classes to serve as both database entities and GraphQL types
import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { UserSetting } from './user-setting';

@Entity({ name: 'users' }) // GraphQL-step 5 - TypeORM entity decorator
@ObjectType() // GraphQL-step 6 - GraphQL object type decorator
export class User {
    @PrimaryGeneratedColumn() // GraphQL-step 5 - TypeORM primary key
    @Field(type => Int) // GraphQL-step 6 - GraphQL field decorator
    id: number;

    @Column() // GraphQL-step 5 - TypeORM column
    @Field() // GraphQL-step 6 - GraphQL field
    username: string;

    @Column({ nullable: true }) // GraphQL-step 5 - TypeORM nullable column
    @Field({ nullable: true }) // GraphQL-step 6 - GraphQL nullable field
    displayName?: string;

    // GraphQL-step 17 - Database Relationship Configuration
    // Implement proper TypeORM relationships (@OneToOne, @JoinColumn) between entities
    @OneToOne(() => UserSetting)
    @JoinColumn()
    @Field({ nullable: true })
    settings?: UserSetting;
}
