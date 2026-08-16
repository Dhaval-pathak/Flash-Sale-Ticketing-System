# Flash-Sale Ticketing System

This repository is a demo implementation of a flash-sale ticketing platform designed to show safe inventory handling under high concurrency. It includes an API, a background worker, a Streamlit UI, and local infrastructure composed with Docker.

## What Is Implemented

- `db/init.sql`: PostgreSQL schema and mock seed data.
- `docker-compose.yml`: local services for Postgres, Redis, API, and worker.
- `api/`: minimal Node.js API (`/health`, `/api/events`).
- `worker/`: expiration worker that restores inventory and writes outbox events.
- `ui/app.py`: Streamlit UI to read event inventory from the API.

## High-Level Architecture

```mermaid
flowchart LR
	U[User] --> UI[Streamlit UI]
	UI --> API[Node.js API]
	API --> PG[(PostgreSQL)]
	API --> REDIS[(Redis)]
	PG --> OUTBOX[outbox_events table]
	OUTBOX --> RELAY[Outbox Relay]
	RELAY --> KAFKA[(Kafka/Event Bus)]
	KAFKA --> CONS[Consumers: mail, analytics, reconciliation]
```

System responsibilities:

- API handles request validation and transactional writes.
- PostgreSQL is the source of truth for inventory, reservations, orders, and outbox.
- Redis helps with short-lived coordination (locks/rate-limit/TTL patterns).
- Worker/relay handles asynchronous background work outside the API request path.

## Why `event_inventory_view` Exists

`event_inventory_view` is a SQL view that joins `events` and `ticket_inventory` so the UI/API can read a simple, ready-to-display projection.

It avoids repeating the same join query in multiple places and keeps read endpoints straightforward.

## Outbox Pattern (Detailed)

### The problem

If the API does:
1. update DB state, and then
2. publish to Kafka,

there is a failure gap between those operations.

- DB success + publish fail => missing event
- publish success + DB rollback => ghost event

Both are consistency bugs.

### The solution

Write the event to `outbox_events` **inside the same DB transaction** as the business state change. Then a separate relay process publishes outbox rows to Kafka and marks them published.

This gives atomic DB persistence and reliable async publish.

### Outbox sequence

```mermaid
sequenceDiagram
	participant C as Client
	participant API as API
	participant PG as PostgreSQL
	participant RELAY as Outbox Relay
	participant K as Kafka

	C->>API: POST /api/reserve
	API->>PG: BEGIN transaction
	API->>PG: SELECT ... FOR UPDATE
	API->>PG: UPDATE ticket_inventory
	API->>PG: INSERT reservation
	API->>PG: INSERT outbox_events
	API->>PG: COMMIT
	API-->>C: 201 Created

	RELAY->>PG: SELECT unpublished outbox rows
	RELAY->>K: publish(event)
	K-->>RELAY: ack
	RELAY->>PG: UPDATE outbox_events SET published_at = NOW()
```

### Transaction example

```sql
BEGIN;

SELECT remaining_capacity
FROM ticket_inventory
WHERE event_id = $1 AND ticket_type = $2
FOR UPDATE;

UPDATE ticket_inventory
SET remaining_capacity = remaining_capacity - $3,
		version = version + 1,
		updated_at = NOW()
WHERE event_id = $1 AND ticket_type = $2;

INSERT INTO reservations (id, user_id, event_id, ticket_type, quantity, status, expires_at)
VALUES (gen_random_uuid(), $4, $1, $2, $3, 'PENDING', NOW() + INTERVAL '5 minutes');

INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
VALUES (
	gen_random_uuid(),
	'reservation',
	<reservation_id>,
	'reservation.created',
	jsonb_build_object('reservationId', <reservation_id>, 'userId', $4, 'quantity', $3)
);

COMMIT;
```

### Relay behavior

- Poll rows where `published_at IS NULL`.
- Publish each row payload to Kafka.
- Only after broker ack, update `published_at`.
- Retry on transient failure with backoff.
- Keep consumers idempotent because delivery is usually at-least-once.

## Local Setup

1. Start services:

```powershell
docker compose up -d --build
```

2. Verify seed data:

```powershell
docker compose exec postgres psql -U postgres -d ticketing -c "SELECT * FROM event_inventory_view;"
```

3. Check API:

- `http://localhost:3000/health`
- `http://localhost:3000/api/events`

4. Watch worker logs:

```powershell
docker compose logs -f worker
```

## Notes

- Keep real secrets in local `.env` only.
- Commit `.env.example`, not `.env`.
- PostgreSQL remains source of truth even if Redis/Kafka are unavailable.

