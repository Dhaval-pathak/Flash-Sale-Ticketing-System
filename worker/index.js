require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'ticketing'}`,
});

async function expireReservations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      "SELECT id, event_id, ticket_type, quantity FROM reservations WHERE status = 'PENDING' AND expires_at <= NOW() FOR UPDATE"
    );

    for (const r of res.rows) {
      await client.query("UPDATE reservations SET status = 'EXPIRED' WHERE id = $1", [r.id]);

      await client.query(
        `UPDATE ticket_inventory
         SET remaining_capacity = remaining_capacity + $1,
             version = version + 1,
             updated_at = NOW()
         WHERE event_id = $2 AND ticket_type = $3`,
        [r.quantity, r.event_id, r.ticket_type]
      );

      await client.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
         VALUES (gen_random_uuid(), 'reservation', $1, 'reservation.expired', $2)`,
        [r.id, JSON.stringify({ reservationId: r.id, quantity: r.quantity })]
      );
    }

    await client.query('COMMIT');

    if (res.rowCount > 0) {
      console.log(`expired ${res.rowCount} reservations`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('error expiring reservations', err);
  } finally {
    client.release();
  }
}

expireReservations();
setInterval(expireReservations, 60 * 1000);
