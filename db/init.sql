-- Fresh local database schema. Existing volumes need an explicit migration; this
-- initialization script is not applied by PostgreSQL to an existing data volume.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  venue VARCHAR(255),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  sale_starts_at TIMESTAMPTZ NOT NULL,
  sale_ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (sale_ends_at > sale_starts_at)
);

CREATE TABLE IF NOT EXISTS ticket_inventory (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type VARCHAR(64) NOT NULL,
  total_capacity INT NOT NULL CHECK (total_capacity >= 0),
  remaining_capacity INT NOT NULL CHECK (remaining_capacity >= 0 AND remaining_capacity <= total_capacity),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, ticket_type)
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type VARCHAR(64) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  payment_reference VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_reservations_status_expires ON reservations (status, expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type VARCHAR(64) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'PAID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY,
  aggregate_type VARCHAR(128) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_events_published ON outbox_events (published_at);

-- Stable UUIDs are shared by this SQL seed and the Prisma seed.
INSERT INTO users (id, email, name, is_blocked) VALUES
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com', 'Alice Demo', FALSE),
  ('11111111-1111-4111-8111-111111111112', 'bob@example.com', 'Bob VIP', FALSE),
  ('11111111-1111-4111-8111-111111111113', 'charlie@example.com', 'Charlie Fan', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, slug, title, description, venue, starts_at, ends_at, sale_starts_at, sale_ends_at, status)
VALUES ('22222222-2222-4222-8222-222222222222', 'demo-concert', 'Demo Concert', 'A local flash-sale ticket demo.', 'Demo Venue',
  NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days 3 hours',
  NOW() - INTERVAL '1 hour', NOW() + INTERVAL '30 days', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_inventory (id, event_id, ticket_type, total_capacity, remaining_capacity, price)
VALUES
  ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222222', 'VIP', 10, 10, 99.99),
  ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222222', 'GENERAL', 100, 100, 29.99)
ON CONFLICT (event_id, ticket_type) DO NOTHING;

CREATE OR REPLACE VIEW event_inventory_view AS
SELECT e.id AS event_id, e.title, ti.ticket_type,
       ti.total_capacity, ti.remaining_capacity, ti.price,
       e.status AS status, e.status AS event_status,
       e.sale_starts_at, e.sale_ends_at
FROM events e JOIN ticket_inventory ti ON ti.event_id = e.id;

-- Ensure role dhaval_test (and alias dhavaltest) exists as the default application role with full privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dhaval_test') THEN
    CREATE ROLE dhaval_test WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '1234';
  ELSE
    ALTER ROLE dhaval_test WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '1234';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dhavaltest') THEN
    CREATE ROLE dhavaltest WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '1234';
  ELSE
    ALTER ROLE dhavaltest WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '1234';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE ticketing TO dhaval_test, dhavaltest;
GRANT ALL ON SCHEMA public TO dhaval_test, dhavaltest;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dhaval_test, dhavaltest;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dhaval_test, dhavaltest;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO dhaval_test, dhavaltest;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dhaval_test, dhavaltest;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dhaval_test, dhavaltest;
GRANT postgres TO dhaval_test, dhavaltest;

