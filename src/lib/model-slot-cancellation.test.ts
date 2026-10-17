import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.appointments (id text PRIMARY KEY, profile_id text, status text);
    CREATE TABLE public.model_slots (id text PRIMARY KEY, profile_id text, booked_appointment_id text, updated_at timestamptz);
  `);
  await db.exec(await readFile("drizzle/migrations/0009_release_cancelled_model_slots.sql", "utf8"));
});
afterAll(async () => { await db.close(); });

test("cancelled unpaid booking releases the 19 November 11:00 model slot", async () => {
  await db.exec(`
    INSERT INTO appointments VALUES ('unpaid', 'supreme', 'pending');
    INSERT INTO model_slots VALUES ('nov19-1100', 'supreme', 'unpaid', now());
    UPDATE appointments SET status='cancelled' WHERE id='unpaid';
  `);
  const { rows } = await db.query<{ booked_appointment_id: string | null }>("SELECT booked_appointment_id FROM model_slots WHERE id='nov19-1100'");
  expect(rows[0]?.booked_appointment_id).toBeNull();
});

test("successful confirmation preserves the reserved model slot", async () => {
  await db.exec(`
    INSERT INTO appointments VALUES ('paid', 'supreme', 'pending');
    INSERT INTO model_slots VALUES ('confirmed', 'supreme', 'paid', now());
    UPDATE appointments SET status='confirmed' WHERE id='paid';
  `);
  const { rows } = await db.query<{ booked_appointment_id: string }>("SELECT booked_appointment_id FROM model_slots WHERE id='confirmed'");
  expect(rows[0]?.booked_appointment_id).toBe('paid');
});

test("late cancellation cannot release another appointment or clinic's slot", async () => {
  await db.exec(`
    INSERT INTO appointments VALUES ('old', 'supreme', 'pending');
    INSERT INTO model_slots VALUES ('replacement', 'supreme', 'new', now()), ('other-clinic', 'other', 'old', now());
    UPDATE appointments SET status='cancelled' WHERE id='old';
  `);
  const { rows } = await db.query<{ id: string; booked_appointment_id: string }>("SELECT id, booked_appointment_id FROM model_slots WHERE id IN ('replacement','other-clinic') ORDER BY id");
  expect(rows).toEqual([{ id: 'other-clinic', booked_appointment_id: 'old' }, { id: 'replacement', booked_appointment_id: 'new' }]);
});