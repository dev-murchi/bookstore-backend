import { registerAs } from "@nestjs/config";

export interface DatabaseConfig {
    url: string;
    name: string;
    host: string;
    port: number;
    user: string;
    password: string;
}

export const databaseConfig = registerAs<DatabaseConfig>('db', () => {
    const url = process.env.DATABASE_URL;
    const name = process.env.DB_NAME;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;

    if (typeof url !== 'string' || url.trim() === '') {
        throw new Error('DATABASE_URL must be a non-empty string');
    }
    if (typeof name !== 'string' || name.trim() === '') {
        throw new Error('DB_NAME must be a non-empty string');
    }
    if (typeof host !== 'string' || host.trim() === '') {
        throw new Error('DB_HOST must be a non-empty string');
    }
    if (typeof port !== 'string' || isNaN(Number(port))) {
        throw new Error('DB_PORT must be a valid number string');
    }
    if (typeof user !== 'string' || user.trim() === '') {
        throw new Error('DB_USER must be a non-empty string');
    }
    if (typeof password !== 'string' || password.trim() === '') {
        throw new Error('DB_PASSWORD must be a non-empty string');
    }

    return {
        url,
        name,
        host,
        port: Number(port),
        user,
        password,
    };
});
