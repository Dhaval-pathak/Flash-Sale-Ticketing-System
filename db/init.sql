-- db/init.sql
-- Initialize database schema and insert mock data for local development

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE
);

-- events
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ticket inventory
CREATE TABLE IF NOT EXISTS ticket_inventory (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type VARCHAR(64) NOT NULL,
  total_capacity INT NOT NULL,
  remaining_capacity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, ticket_type)
);

-- reservations
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type VARCHAR(64) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  payment_reference VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE
);

-- indexes for fast expiration polling and outbox relay
CREATE INDEX IF NOT EXISTS idx_reservations_status_expires ON reservations (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_outbox_events_published ON outbox_events (published_at);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type VARCHAR(64) NOT NULL,
  quantity INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PAID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- outbox events for reliable publish
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY,
  aggregate_type VARCHAR(128) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Insert mock data
INSERT INTO users (id, email, name, created_at, is_blocked)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice Demo', NOW(), FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO events (id, slug, title, description, venue, starts_at, ends_at, sale_starts_at, sale_ends_at, status, created_at)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'demo-concert', 'Demo Concert', 'A small demo event for testing flash sale flows.', 'Demo Venue',
   NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '3 hours',
   NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 'ACTIVE', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO ticket_inventory (id, event_id, ticket_type, total_capacity, remaining_capacity, price, version, updated_at)
VALUES
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'VIP', 10, 10, 99.99, 0, NOW()),
  ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222222', 'GENERAL', 100, 100, 29.99, 0, NOW())
ON CONFLICT DO NOTHING;

-- Sample pending reservation (will expire shortly)
INSERT INTO reservations (id, user_id, event_id, ticket_type, quantity, status, expires_at, created_at)
VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIP', 1, 'PENDING', NOW() + INTERVAL '5 minutes', NOW())
ON CONFLICT DO NOTHING;

-- Sample outbox event for the reservation created
INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, created_at)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'reservation', '44444444-4444-4444-4444-444444444444', 'reservation.created',
   JSONB_BUILD_OBJECT('reservationId', '44444444-4444-4444-4444-444444444444', 'userId', '11111111-1111-1111-1111-111111111111', 'quantity', 1), NOW())
ON CONFLICT DO NOTHING;

-- Convenience view to inspect remaining capacity
CREATE OR REPLACE VIEW event_inventory_view AS
SELECT e.id AS event_id, e.title, ti.ticket_type, ti.total_capacity, ti.remaining_capacity, ti.price
FROM events e
JOIN ticket_inventory ti ON ti.event_id = e.id;
