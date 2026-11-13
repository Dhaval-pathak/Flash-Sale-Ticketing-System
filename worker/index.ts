import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { expireReservations } from '../api/src/services/ticketingService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${
      process.env.POSTGRES_HOST || 'localhost'
    }:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'ticketing'}`
});

let running = false;
let stopping = false;
let timer: NodeJS.Timeout | undefined;

/**
 * Runs a single bounded sweep to expire past-deadline reservations and restore inventory.
 */
export async function runSweep(): Promise<void> {
  if (running || stopping) return;
  running = true;
  try {
    const expiredCount = await expireReservations(pool, 100);
    if (expiredCount > 0) {
      console.log(`expired ${expiredCount} reservations`);
    }
  } catch (error) {
    console.error('error expiring reservations; the next interval will retry', error);
  } finally {
    running = false;
  }
}

/**
 * Gracefully shuts down the background worker.
 */
export async function shutdown(): Promise<void> {
  stopping = true;
  if (timer) clearInterval(timer);
  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await pool.end();
}

/**
 * Starts periodic polling for expired reservations.
 */
export function start(): void {
  const intervalMs = Number(process.env.WORKER_INTERVAL_MS) || 1000;
  console.log(`Worker started, sweeping expired reservations every ${intervalMs}ms`);
  timer = setInterval(runSweep, intervalMs);

  process.on('SIGINT', () => shutdown().then(() => process.exit(0)));
  process.on('SIGTERM', () => shutdown().then(() => process.exit(0)));
}

if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
  start();
}
