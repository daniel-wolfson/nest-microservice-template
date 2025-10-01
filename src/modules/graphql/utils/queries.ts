// GraphQL-step 15 - Create GraphQL Queries for Testing
// Write GraphQL query and mutation operations using graphql-tag for testing purposes
// These queries serve as examples of how clients will interact with your API
import gql from 'graphql-tag';

// GraphQL-step 15 - Example mutation for creating a user
export const createUserMutation = gql`
    mutation {
        createUser(createUserData: { username: "testuser", displayName: "testuser" }) {
            id
            username
            displayName
        }
    }
`;

// GraphQL-step 15 - Example query for fetching all users
export const getUsersQuery = gql`
    {
        getUsers {
            id
            username
            displayName
        }
    }
`;
