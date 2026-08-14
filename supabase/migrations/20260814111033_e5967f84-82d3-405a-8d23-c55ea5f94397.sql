CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Backfill any booking missing a room number, lowest free number first.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY room_id, booking_date ORDER BY created_at) AS rn
  FROM public.rental_bookings
  WHERE unit_index IS NULL AND status <> 'cancelled'
)
UPDATE public.rental_bookings b
SET unit_index = LEAST(r.rn, GREATEST(1, COALESCE(rr.quantity, 1)))
FROM ranked r
JOIN public.rental_rooms rr ON rr.id = (SELECT room_id FROM public.rental_bookings x WHERE x.id = r.id)
WHERE b.id = r.id;

UPDATE public.rental_bookings SET unit_index = 1 WHERE unit_index IS NULL AND status <> 'cancelled';

-- Resolve any pre-existing overlaps by pushing later duplicates onto free numbers.
DO $$
DECLARE rec RECORD; n int;
BEGIN
  FOR rec IN
    SELECT b.id, b.room_id, b.booking_date, b.start_time, b.end_time, COALESCE(rr.quantity,1) AS cap
    FROM public.rental_bookings b
    JOIN public.rental_rooms rr ON rr.id = b.room_id
    WHERE b.status <> 'cancelled'
    ORDER BY b.created_at
  LOOP
    n := 1;
    WHILE n <= GREATEST(rec.cap, 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.rental_bookings o
        WHERE o.id <> rec.id AND o.status <> 'cancelled'
          AND o.room_id = rec.room_id AND o.booking_date = rec.booking_date
          AND o.unit_index = n
          AND o.start_time < rec.end_time AND o.end_time > rec.start_time
      ) THEN EXIT; END IF;
      n := n + 1;
    END LOOP;
    UPDATE public.rental_bookings SET unit_index = n WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_no_double_booking
  EXCLUDE USING gist (
    room_id WITH =,
    booking_date WITH =,
    unit_index WITH =,
    int4range(
      (EXTRACT(HOUR FROM start_time)::int * 60 + EXTRACT(MINUTE FROM start_time)::int),
      (EXTRACT(HOUR FROM end_time)::int * 60 + EXTRACT(MINUTE FROM end_time)::int)
    ) WITH &&
  )
  WHERE (status <> 'cancelled' AND unit_index IS NOT NULL);