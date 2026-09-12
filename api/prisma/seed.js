// api/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with Prisma...');

  // 0. Clean transient transactional data so full inventory starts with zero conflicting holds
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.outboxEvent.deleteMany();
  console.log('✓ Cleaned previous orders, reservations, and outbox events');

  // 1. Seed Users with friendly IDs
  const users = [
    { id: 'usr_alice', email: 'alice@example.com', name: 'Alice Demo', isBlocked: false },
    { id: 'usr_bob', email: 'bob@example.com', name: 'Bob VIP', isBlocked: false },
    { id: 'usr_charlie', email: 'charlie@example.com', name: 'Charlie Fan', isBlocked: false }
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, email: u.email, isBlocked: u.isBlocked },
      create: u
    });
  }
  console.log(`✓ Seeded ${users.length} users with clean IDs`);

  // 2. Seed Event with ACTIVE sale window (now - 1 hour to now + 30 days)
  const now = new Date();
  const saleStartsAt = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
  const saleEndsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30); // 30 days in future
  const startsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 35);
  const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 35 + 1000 * 60 * 60 * 3);

  const event = await prisma.event.upsert({
    where: { id: 'evt_demo_concert' },
    update: {
      saleStartsAt,
      saleEndsAt,
      startsAt,
      endsAt,
      status: 'ACTIVE'
    },
    create: {
      id: 'evt_demo_concert',
      slug: 'demo-concert-2026',
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

  // 3. Seed Ticket Inventory
  const inventories = [
    {
      id: 'inv_demo_vip',
      eventId: 'evt_demo_concert',
      ticketType: 'VIP',
      totalCapacity: 10,
      remainingCapacity: 10,
      price: 99.99,
      version: 0
    },
    {
      id: 'inv_demo_general',
      eventId: 'evt_demo_concert',
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
      update: {
        totalCapacity: inv.totalCapacity,
        remainingCapacity: inv.remainingCapacity,
        price: inv.price
      },
      create: inv
    });
  }
  console.log(`✓ Seeded ticket inventories: VIP (10) and GENERAL (100)`);

  // 4. Ensure event_inventory_view exists for read queries
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW event_inventory_view AS
    SELECT e.id AS event_id, e.title, ti.ticket_type, ti.total_capacity, ti.remaining_capacity, ti.price
    FROM events e
    JOIN ticket_inventory ti ON ti.event_id = e.id
    ORDER BY e.id ASC, ti.price DESC;
  `);
  console.log('✓ Verified event_inventory_view');

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
