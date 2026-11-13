import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded so DATABASE_URL is available
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${
    process.env.POSTGRES_HOST || 'localhost'
  }:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'ticketing'}`;

process.env.DATABASE_URL = connectionString;

/**
 * Seeds data directly via pg Pool as a fast, zero-generator-dependency path.
 */
async function seedWithPg(): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  console.log('Seeding database via PostgreSQL client...');
  try {
    await pool.query(`
      INSERT INTO users (id, email, name, is_blocked) VALUES
        ('11111111-1111-4111-8111-111111111111', 'alice@example.com', 'Alice Demo', FALSE),
        ('11111111-1111-4111-8111-111111111112', 'bob@example.com', 'Bob VIP', FALSE),
        ('11111111-1111-4111-8111-111111111113', 'charlie@example.com', 'Charlie Fan', FALSE)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
    `);
    console.log('✓ Seeded 3 demo users with clean IDs');

    await pool.query(`
      INSERT INTO events (id, slug, title, description, venue, starts_at, ends_at, sale_starts_at, sale_ends_at, status)
      VALUES (
        '22222222-2222-4222-8222-222222222222',
        'demo-concert',
        'Demo Concert',
        'A live high-concurrency flash sale demo event.',
        'Grand Arena',
        NOW() + INTERVAL '35 days',
        NOW() + INTERVAL '35 days 3 hours',
        NOW() - INTERVAL '1 hour',
        NOW() + INTERVAL '30 days',
        'ACTIVE'
      )
      ON CONFLICT (id) DO UPDATE SET
        sale_starts_at = EXCLUDED.sale_starts_at,
        sale_ends_at = EXCLUDED.sale_ends_at,
        status = EXCLUDED.status;
    `);
    console.log('✓ Seeded active event: Demo Concert (22222222-2222-4222-8222-222222222222)');

    await pool.query(`
      INSERT INTO ticket_inventory (id, event_id, ticket_type, total_capacity, remaining_capacity, price, version)
      VALUES
        ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222222', 'VIP', 10, 10, 99.99, 0),
        ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222222', 'GENERAL', 100, 100, 29.99, 0)
      ON CONFLICT (event_id, ticket_type) DO NOTHING;
    `);
    console.log('✓ Seeded ticket inventories: VIP (10) and GENERAL (100)');

    await pool.query(`
      CREATE OR REPLACE VIEW event_inventory_view AS
      SELECT e.id AS event_id, e.title, ti.ticket_type,
             ti.total_capacity, ti.remaining_capacity, ti.price,
             e.status AS event_status, e.sale_starts_at, e.sale_ends_at
      FROM events e
      JOIN ticket_inventory ti ON ti.event_id = e.id;
    `);
    console.log('✓ Verified event_inventory_view');
    console.log('Database seeding complete!');
  } finally {
    await pool.end();
  }
}

/**
 * Seeds data via Prisma Client if generated, otherwise delegates to seedWithPg.
 */
async function main(): Promise<void> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      console.log('Seeding database with Prisma Client...');
      const users = [
        { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.com', name: 'Alice Demo', isBlocked: false },
        { id: '11111111-1111-4111-8111-111111111112', email: 'bob@example.com', name: 'Bob VIP', isBlocked: false },
        { id: '11111111-1111-4111-8111-111111111113', email: 'charlie@example.com', name: 'Charlie Fan', isBlocked: false }
      ];

      for (const u of users) {
        await prisma.user.upsert({
          where: { id: u.id },
          update: { name: u.name, email: u.email },
          create: u
        });
      }
      console.log(`✓ Seeded ${users.length} users with clean IDs`);

      const now = new Date();
      const saleStartsAt = new Date(now.getTime() - 1000 * 60 * 60);
      const saleEndsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
      const startsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 35);
      const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 35 + 1000 * 60 * 60 * 3);

      const event = await prisma.event.upsert({
        where: { id: '22222222-2222-4222-8222-222222222222' },
        update: {
          saleStartsAt,
          saleEndsAt,
          startsAt,
          endsAt,
          status: 'ACTIVE'
        },
        create: {
          id: '22222222-2222-4222-8222-222222222222',
          slug: 'demo-concert',
          title: 'Demo Concert',
          description: 'A live high-concurrency flash sale demo event.',
          venue: 'Grand Arena',
          startsAt,
          endsAt,
          saleStartsAt,
          saleEndsAt,
          status: 'ACTIVE'
        }
      });
      console.log(`✓ Seeded active event: ${event.title} (${event.id})`);

      const inventories = [
        {
          id: '33333333-3333-4333-8333-333333333331',
          eventId: '22222222-2222-4222-8222-222222222222',
          ticketType: 'VIP',
          totalCapacity: 10,
          remainingCapacity: 10,
          price: 99.99,
          version: 0
        },
        {
          id: '33333333-3333-4333-8333-333333333332',
          eventId: '22222222-2222-4222-8222-222222222222',
          ticketType: 'GENERAL',
          totalCapacity: 100,
          remainingCapacity: 100,
          price: 29.99,
          version: 0
        }
      ];

      for (const inv of inventories) {
        await prisma.ticketInventory.upsert({
          where: {
            eventId_ticketType: {
              eventId: inv.eventId,
              ticketType: inv.ticketType
            }
          },
          update: {},
          create: inv
        });
      }
      console.log(`✓ Seeded ticket inventories: VIP (10) and GENERAL (100)`);

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE VIEW event_inventory_view AS
        SELECT e.id AS event_id, e.title, ti.ticket_type,
               ti.total_capacity, ti.remaining_capacity, ti.price,
               e.status AS event_status, e.sale_starts_at, e.sale_ends_at
        FROM events e
        JOIN ticket_inventory ti ON ti.event_id = e.id
        ;
      `);
      console.log('✓ Verified event_inventory_view');
      console.log('Database seeding complete!');
      await prisma.$disconnect();
      return;
    } catch (err) {
      console.warn('Prisma Client failed, switching to pg client fallback:', err);
      await prisma.$disconnect().catch(() => {});
    }
  } catch {
    // Prisma client package or binary is absent
  }

  await seedWithPg();
}

main().catch((e) => {
  console.error('Error during seeding:', e);
  process.exit(1);
});
