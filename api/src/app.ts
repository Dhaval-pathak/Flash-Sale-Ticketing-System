import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createTicketingRoutes } from './routes/ticketingRoutes.ts';
import type { ServiceError } from './types/contracts.ts';

/**
 * Creates the Express application instance without binding to a port.
 * @param pool Shared PostgreSQL connection pool.
 * @returns Configured Express application.
 */
export function createApp(pool: Pool): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', createTicketingRoutes(pool));

  app.use((error: ServiceError, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(error);
    }
    const status = Number.isInteger(error.status) ? (error.status as number) : 500;
    if (status === 500) {
      console.error('API request failed:', error);
    }
    return res.status(status).json({
      error: status === 500 ? 'Internal server error.' : error.message
    });
  });

  return app;
}
