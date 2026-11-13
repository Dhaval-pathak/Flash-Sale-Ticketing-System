import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createApp } from './app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Creates the PostgreSQL pool from environment variables.
 * @returns Configured PostgreSQL Pool.
 */
export function createPool(): Pool {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${
        process.env.POSTGRES_HOST || 'localhost'
      }:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'ticketing'}`
  });
}

/**
 * Starts the HTTP server listener and registers termination handlers.
 */
export function start(): void {
  const pool = createPool();
  const app = createApp(pool);
  const port = process.env.API_PORT || 3000;

  const server = app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
  start();
}
