# NestJS Microservice

## Start Template

### Technologies

<table width="100%">
    <tr>  
      <td align="center" valign="middle" width="17%">
      <a href="https://www.postgresql.org/">
      <img height="50" alt="PostgresSQL" src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Postgresql_elephant.svg/640px-Postgresql_elephant.svg.png"/>
      </a>
      <br />
      PostgresSQL
    </td>
    <td align="center" valign="middle" width="17%">
      <a href="https://typeorm.io/">
      <img height="50" alt="TypeORM" src="https://www.zoneofit.com/wp-content/uploads/2021/06/type-orm.png"/>
      </a>
      <br />
      TypeORM
    </td>
    <td align="center" valign="middle" width="17%">
      <a href="https://www.docker.com/">
      <img height="50" alt="Docker" src="https://d1.awsstatic.com/acs/characters/Logos/Docker-Logo_Horizontel_279x131.b8a5c41e56b77706656d61080f6a0217a3ba356d.png"/>
      </a>
      <br />
      Docker
    </td>
    <td align="center" valign="middle" width="17%">
      <a href="https://www.npmjs.com/package/@golevelup/nestjs-rabbitmq">
      <img height="50" alt="Docker" src="https://www.nastel.com/wp-content/uploads/2022/05/rabbitmq.png"/>
      </a>
      <br />
      RabbitMQ
    </td>
    </tr>
</table>

### Initial settings

-   create <b>.env</b> file. Example inside <a href="https://github.com/daniel-wolfson/Nest-microservice-template/blob/master/.env">.env</a>
-   create Postgres db and set url to the .env or run <a href="https://github.com/daniel-wolfson/Nest-microservice-template/blob/master/docker/postgres/docker-compose.yml">docker-compose</a> file with postgres
-   install dependencies

```sh
yarn install
```

-   run migrations

```sh
yarn migration:run
```

### Start app

```sh
yarn start

# develop
yarn start:dev

# production
yarn start:prod
```

### Check if the process is actually listening on the expected port

netstat -ano | findstr :3000

### PowerShell

Invoke-RestMethod -Uri "http://localhost:3000/rabbitmq/status" -Method Get

### Folder Organization Best Practices

src/
├── controllers/
├── services/
├── dto/
├── entities/
├── guards/
└── interceptors/

### Shared Resources Organization

src/
├── common/ # Cross-cutting concerns
├── config/ # Configuration files
├── database/ # Database-specific code
├── shared/ # Shared business logic
└── utils/ # Pure utility functions

### Basic NestJS Project Structure

src/
├── main.ts # Application entry point
├── app.module.ts # Root module
├── app.controller.ts # Root controller (optional)
├── app.service.ts # Root service (optional)
├── modules/ # Feature modules
│ ├── auth/
│ │ ├── auth.module.ts
│ │ ├── auth.controller.ts
│ │ ├── auth.service.ts
│ │ ├── dto/
│ │ │ ├── login.dto.ts
│ │ │ └── register.dto.ts
│ │ ├── guards/
│ │ │ └── jwt-auth.guard.ts
│ │ ├── strategies/
│ │ │ └── jwt.strategy.ts
│ │ └── interfaces/
│ │ └── auth.interface.ts
│ ├── users/
│ │ ├── users.module.ts
│ │ ├── users.controller.ts
│ │ ├── users.service.ts
│ │ ├── dto/
│ │ │ ├── create-user.dto.ts
│ │ │ └── update-user.dto.ts
│ │ ├── entities/
│ │ │ └── user.entity.ts
│ │ └── interfaces/
│ │ └── user.interface.ts
│ └── channels/ # Your existing module
│ ├── channels.module.ts
│ ├── channels.controller.ts
│ ├── channels.service.ts
│ └── dto/
├── common/ # Shared utilities
│ ├── decorators/
│ │ ├── roles.decorator.ts
│ │ └── user.decorator.ts
│ ├── filters/
│ │ └── http-exception.filter.ts
│ ├── guards/
│ │ └── roles.guard.ts
│ ├── interceptors/
│ │ ├── logging.interceptor.ts
│ │ └── transform.interceptor.ts
│ ├── pipes/
│ │ └── validation.pipe.ts
│ ├── middlewares/
│ │ └── logger.middleware.ts
│ └── constants/
│ └── index.ts
├── config/ # Configuration files
│ ├── database.config.ts
│ ├── jwt.config.ts
│ └── app.config.ts
├── database/ # Database related files
│ ├── migrations/
│ ├── seeds/
│ └── factories/
└── libs/ # Shared libraries (if using monorepo)
├── common/
├── entities/
└── providers/

### API commands

-   Get all messages: http://localhost:3000/rabbitmq/messages
-   Get latest message: http://localhost:3000/rabbitmq/messages/latest
-   Check connection status: http://localhost:3000/rabbitmq/status
-   Simulate sending a message: http://localhost:3000/rabbitmq/simulate?message=Hello%20World
-   Clear all messages: http://localhost:3000/rabbitmq/clear

### The end 🙂
