# Adding Prisma to Your NestJS Project

This guide provides step-by-step instructions for integrating Prisma into a NestJS application, based on the current configuration of this project.

## Table of Contents

-   [Prerequisites](#prerequisites)
-   [Step 1: Install Dependencies](#step-1-install-dependencies)
-   [Step 2: Initialize Prisma](#step-2-initialize-prisma)
-   [Step 3: Configure Database Connection](#step-3-configure-database-connection)
-   [Step 4: Define Your Schema](#step-4-define-your-schema)
-   [Step 5: Generate Prisma Client](#step-5-generate-prisma-client)
-   [Step 6: Create and Run Migrations](#step-6-create-and-run-migrations)
-   [Step 7: Create Database Seed File](#step-7-create-database-seed-file)
-   [Step 8: Integrate with NestJS](#step-8-integrate-with-nestjs)
-   [Step 9: Add NPM Scripts](#step-9-add-npm-scripts)
-   [Step 10: Docker Setup (Optional)](#step-10-docker-setup-optional)
-   [Additional Configuration](#additional-configuration)

---

## Prerequisites

-   Node.js >= 22.12.0
-   npm or yarn
-   PostgreSQL database (local or remote)
-   NestJS project initialized

---

## Step 1: Install Dependencies

Install Prisma CLI as a dev dependency and Prisma Client as a regular dependency:

```bash
npm install @prisma/client
npm install prisma --save-dev
npm install nestjs-prisma --save
```

**Dependencies installed:**

-   `@prisma/client`: ^6.0.1 - Runtime client for database queries
-   `prisma`: 6.0.1 - Prisma CLI for schema management and migrations
-   `nestjs-prisma`: 0.24.0-dev.0 - NestJS integration module (optional but recommended)

**Optional generators:**

```bash
npm install prisma-dbml-generator --save-dev
```

This generates DBML (Database Markup Language) diagrams from your schema.

---

## Step 2: Initialize Prisma

Initialize Prisma in your project:

```bash
npx prisma init
```

This creates:

-   `prisma/` directory
-   `prisma/schema.prisma` file
-   `.env` file (if it doesn't exist)

---

## Step 3: Configure Database Connection

### 3.1 Create/Update `.env` File

Create a `.env` file in your project root (if not already created):

```env
# Database connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Example for local PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/nestjs_example?schema=public"

# PostgreSQL specific settings (for Docker)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=nestjs_example
```

**Important:** Add `.env` to your `.gitignore` file to prevent committing sensitive data.

### 3.2 Configure Environment Variables in NestJS

Ensure you have `@nestjs/config` installed and configured in your `app.module.ts`:

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        // ... other modules
    ],
})
export class AppModule {}
```

---

## Step 4: Define Your Schema

Update `prisma/schema.prisma` with your database configuration and models:

```prisma
// Database configuration
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Prisma Client generator
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["omitApi"]
}

// Optional: DBML generator for visual diagrams
generator dbml {
  provider = "prisma-dbml-generator"
}

// Example model from current project
model User {
  id                 String   @id @default(uuid())
  createdAt          DateTime @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime @updatedAt @db.Timestamptz(3)
  name               String
  email              String   @unique
  password           String
  favouritePokemonId Int
  language           Language
  terms              Boolean  @default(false)
  caughtPokemonIds   Int[]    @default([])
}

// Enum example
enum Language {
  ES_ES
  EN_US
}
```

**Key Configuration Details:**

-   **Provider**: `postgresql` - Change to `mysql`, `sqlite`, `sqlserver`, or `mongodb` based on your database
-   **Preview Features**: `omitApi` - Allows omitting sensitive fields (like passwords) from queries
-   **Timestamptz(3)**: PostgreSQL-specific timezone-aware timestamp with millisecond precision
-   **@id @default(uuid())**: Uses UUID for primary keys
-   **@unique**: Enforces uniqueness constraint
-   **@updatedAt**: Automatically updates timestamp on record updates
-   **Int[]**: Array type for PostgreSQL

---

## Step 5: Generate Prisma Client

After defining your schema, generate the Prisma Client:

```bash
npx prisma generate
```

This command:

-   Reads your `schema.prisma` file
-   Generates TypeScript types in `node_modules/@prisma/client`
-   Creates type-safe database client methods
-   Generates DBML diagram (if configured)

**Note:** Run this command every time you modify your schema.

---

## Step 6: Create and Run Migrations

### 6.1 Create Your First Migration

```bash
npx prisma migrate dev --name init
```

This will:

-   Create a new migration in `prisma/migrations/`
-   Apply the migration to your database
-   Regenerate Prisma Client

After migration command applied, on console you see

```:
  npx prisma migrate dev --name init
  >>
  Loaded Prisma config from prisma.config.ts.
  Prisma schema loaded from prisma\schema.prisma.
  Datasource "db": PostgreSQL database "postgres", schema "public" at "localhost:5432"
  Drift detected: Your database schema is not in sync with your migration history.
  The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.
  It should be understood as the set of changes to get from the expected schema to the actual schema.
  If you are running this the first time on an existing database, please make sure to read this documentation page:
  https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/troubleshooting-development

  [+] Added tables
    - config
    - user_settings
    - users

  [*] Changed the `users` table
    [+] Added unique index on columns (settingsUserId)
    [+] Added foreign key on columns (settingsUserId)

  We need to reset the "public" schema at "localhost:5432"

  You may use prisma migrate reset to drop the development database.
  All data will be lost.
```

### 6.2 Migration Commands Reference

```bash
# Create and apply a new migration (development)
npx prisma migrate dev --name migration_name

# Apply pending migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Push schema changes without migrations (for prototyping)
npx prisma db push
```

**Current project migration structure:**

```
prisma/migrations/
├── migration_lock.toml
└── 20241218145504_/
    └── migration.sql
```

---

## Step 7: Create Database Seed File

### 7.1 Create `prisma/seed.ts`

```typescript
import { Language, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    await prisma.user.deleteMany();

    // eslint-disable-next-line no-console
    console.log('Seeding...');

    const plainPassword = 'Secret42';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    // Result: $2b$10$yjh4MYBO/eNJKxcpODqbt.dQ/0u80wV.bR5uFRv7n27bmHI0glw1G

    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    // eslint-disable-next-line no-console
    console.log('', isMatch);

    await prisma.user.create({
        data: {
            email: 'maverick@topgun.com',
            name: 'Pete',
            language: Language.EN_US,
            password: hashedPassword,
            favouritePokemonId: 25,
            terms: true,
        },
    });

    // eslint-disable-next-line no-console
    console.log('Data loaded!');
}

// eslint-disable-next-line promise/catch-or-return
main()
    .catch(error => {
        // eslint-disable-next-line no-console
        console.error(error);
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .finally(async () => {
        await prisma.$disconnect();
    });
```

### 7.2 Configure Seed Script in `package.json`

Add the following to your `package.json`:

```json
{
    "prisma": {
        "seed": "ts-node prisma/seed.ts"
    }
}
```

### 7.3 Install Required Dependencies

```bash
npm install ts-node --save-dev
```

### 7.4 Run Seed Command

```bash
npx prisma db seed
```

---

## Step 8: Integrate with NestJS

### 8.1 Create Prisma Service (Option A: Manual)

Create `src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
```

Create `src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
```

### 8.2 Use NestJS Prisma Module (Option B: Recommended)

If you installed `nestjs-prisma`, update `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from 'nestjs-prisma';

@Module({
    imports: [
        PrismaModule.forRoot({
            isGlobal: true,
            prismaServiceOptions: {
                prismaOptions: {
                    log: ['info', 'warn', 'error'],
                },
            },
        }),
        // ... other modules
    ],
})
export class AppModule {}
```

### 8.3 Create Repository Pattern (Example)

Create `src/features/user/user.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { User } from '@prisma/client';

@Injectable()
export class UserRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getUserById(id: string): Promise<Omit<User, 'password'> | null> {
        return this.prisma.user.findUnique({
            where: { id },
            omit: { password: true }, // Requires omitApi preview feature
        });
    }

    async updateUserById(id: string, data: Partial<User>): Promise<Omit<User, 'password'>> {
        return this.prisma.user.update({
            where: { id },
            data,
            omit: { password: true },
        });
    }

    async createUser(data: User): Promise<User> {
        return this.prisma.user.create({ data });
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }
}
```

### 8.4 Create Service Layer (Example)

Create `src/features/user/user.service.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async getMe(userId: string): Promise<Omit<User, 'password'>> {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new BadRequestException('User not found');
        }
        return user;
    }

    async updateUser(userId: string, data: Partial<User>): Promise<Omit<User, 'password'>> {
        return this.userRepository.updateUserById(userId, data);
    }
}
```

### 8.5 Create Module (Example)

Create `src/features/user/user.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

@Module({
    controllers: [UserController],
    providers: [UserService, UserRepository],
    exports: [UserService, UserRepository],
})
export class UserModule {}
```

---

## Step 9: Add NPM Scripts

Add these scripts to your `package.json`:

```json
{
    "scripts": {
        "setup": "npm run docker:db && npm run prisma:generate && npm run prisma:migrate:dev && npm run prisma:seed && npm start",
        "docker:db": "docker-compose -f docker-compose.db.yml up -d",
        "prisma:seed": "prisma db seed",
        "prisma:migrate:dev": "prisma migrate dev --preview-feature",
        "prisma:migrate:deploy": "npx prisma migrate deploy --preview-feature",
        "prisma:generate": "npx prisma generate",
        "prisma:push": "prisma db push",
        "prisma:studio": "npx prisma studio"
    }
}
```

**Script Descriptions:**

-   **setup**: Complete setup for new developers
-   **docker:db**: Start PostgreSQL database in Docker
-   **prisma:seed**: Populate database with seed data
-   **prisma:migrate:dev**: Create and apply migrations (dev environment)
-   **prisma:migrate:deploy**: Apply migrations (production)
-   **prisma:generate**: Generate Prisma Client
-   **prisma:push**: Push schema changes without migrations
-   **prisma:studio**: Open Prisma Studio (database GUI)

---

## Step 10: Docker Setup (Optional)

### 10.1 Create `docker-compose.db.yml`

```yaml
services:
    postgres:
        image: postgres:14.1-alpine
        container_name: postgres
        restart: always
        ports:
            - 5433:5432
        env_file:
            - .env
        environment:
            POSTGRES_USER: ${POSTGRES_USER:-postgres}
            POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
            POSTGRES_DB: ${POSTGRES_DB:-nestjs_example}
        volumes:
            - postgres:/var/lib/postgresql/data

volumes:
    postgres:
        name: nest-db
```

### 10.2 Start Database

```bash
docker-compose -f docker-compose.db.yml up -d
```

### 10.3 Stop Database

```bash
docker-compose -f docker-compose.db.yml down
```

---

## Additional Configuration

### Health Checks

Create a Prisma health indicator for database monitoring:

`src/features/health/prisma-health.indicator.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
    constructor(private readonly prisma: PrismaService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return this.getStatus(key, true);
        } catch (error) {
            throw new HealthCheckError('Prisma check failed', this.getStatus(key, false));
        }
    }
}
```

### TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
    "compilerOptions": {
        "strict": true,
        "strictNullChecks": true,
        "esModuleInterop": true
    }
}
```

### Prisma Studio

Access Prisma Studio to view/edit data in your browser:

```bash
npx prisma studio
```

Opens at: http://localhost:5555

---

## Common Commands Summary

```bash
# Installation
npm install @prisma/client
npm install prisma --save-dev

# Schema Management
npx prisma init                    # Initialize Prisma
npx prisma generate                # Generate Prisma Client
npx prisma db push                 # Push schema changes (prototyping)
npx prisma db pull                 # Pull schema from database

# Migrations
npx prisma migrate dev             # Create and apply migration (dev)
npx prisma migrate deploy          # Apply migrations (production)
npx prisma migrate status          # Check migration status
npx prisma migrate reset           # Reset database

# Seeding
npx prisma db seed                 # Run seed script

# Tools
npx prisma studio                  # Open database GUI
npx prisma format                  # Format schema file
npx prisma validate                # Validate schema file
```

---

## Troubleshooting

### Error: Cannot find module '@prisma/client'

**Solution:**

```bash
npm install @prisma/client
npx prisma generate
```

### Error: Environment variable not found: DATABASE_URL

**Solution:** Ensure `.env` file exists and contains `DATABASE_URL`.

### Migration Conflicts

**Solution:**

```bash
npx prisma migrate reset  # WARNING: Deletes all data
npx prisma migrate dev
```

### Type Errors After Schema Changes

**Solution:**

```bash
npx prisma generate
# Restart TypeScript server in VS Code
```

---

## Best Practices

1. **Always run `prisma generate`** after modifying the schema
2. **Use migrations** for production (not `db push`)
3. **Never commit `.env`** file
4. **Use repository pattern** to centralize database access
5. **Omit sensitive fields** (passwords) from queries
6. **Enable logging** in development for debugging
7. **Use transactions** for related operations
8. **Validate input** before database operations
9. **Handle Prisma errors** gracefully (unique constraints, not found, etc.)
10. **Run migrations** in CI/CD pipeline before deployment

---

## Resources

-   [Prisma Documentation](https://www.prisma.io/docs)
-   [NestJS Prisma Integration](https://docs.nestjs.com/recipes/prisma)
-   [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
-   [Prisma Client API Reference](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
-   [nestjs-prisma Package](https://github.com/notiz-dev/nestjs-prisma)

---

## Summary

This guide covered the complete integration of Prisma into a NestJS application, including:

-   Installing dependencies
-   Configuring database connections
-   Defining schemas and models
-   Running migrations
-   Setting up seed data
-   Integrating with NestJS using repository pattern
-   Docker setup for local development
-   Health checks and monitoring

Follow these steps to replicate the Prisma setup from this project into your own NestJS application.
