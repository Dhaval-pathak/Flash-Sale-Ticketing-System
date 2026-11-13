-- Review/backup the target database before applying this migration manually.
-- API checkout now reads the unit price captured when each hold was created.
BEGIN;

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

UPDATE reservations r
SET unit_price = COALESCE(ti.price, 0)
FROM ticket_inventory ti
WHERE ti.event_id = r.event_id
  AND ti.ticket_type = r.ticket_type
  AND r.unit_price IS NULL;

UPDATE reservations SET unit_price = 0 WHERE unit_price IS NULL;
ALTER TABLE reservations ALTER COLUMN unit_price SET NOT NULL;

CREATE OR REPLACE VIEW event_inventory_view AS
SELECT e.id AS event_id, e.title, ti.ticket_type,
       ti.total_capacity, ti.remaining_capacity, ti.price,
       e.status AS event_status, e.sale_starts_at, e.sale_ends_at
FROM events e JOIN ticket_inventory ti ON ti.event_id = e.id;

COMMIT;
