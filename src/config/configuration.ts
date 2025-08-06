// src/config/configuration.ts
export default () => ({
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,

    database: {
        url: process.env.DATABASE_URL,
    },

    rabbitmq: {
        url: process.env.RABBITMQ_URL,
        user: process.env.RABBITMQ_USER,
        host: process.env.RABBITMQ_HOST,
        password: process.env.RABBITMQ_PASSWORD,
        port: parseInt(process.env.RABBITMQ_PORT, 10) || 15672,
        vhost: process.env.RABBITMQ_VHOST || '/',
    },

    jwt: {
        secret: process.env.JWT_SECRET,
        accessExpiration: parseInt(process.env.JWT_ACCESS_EXPIRATION, 10) || 900,
        refreshExpiration: parseInt(process.env.JWT_REFRESH_EXPIRATION, 10) || 604800,
        issuer: process.env.JWT_ISSUER || 'microservice-template',
        audience: process.env.JWT_AUDIENCE || 'microservice-users',
    },

    logging: {
        level: process.env.LOG_LEVEL || 'log',
    },
});
