import { test } from "node:test";
import assert from "node:assert/strict";
import { rentalDayHasAvailability } from "./room-rental-availability";

const weekdayHours = [{ start_time: "09:00", end_time: "21:00" }]; // 12h
const saturdayHours = [{ start_time: "09:00", end_time: "17:00" }]; // 8h

test("full-day request (12 slots) fits a 12-hour weekday", () => {
  assert.equal(
    rentalDayHasAvailability({ dayHours: weekdayHours, blocks: [], booked: [], capacity: 1, step: 60, needSlots: 12 }),
    true,
  );
});

test("full-day request (12 slots) still books a shorter 8-hour Saturday when fully free", () => {
  assert.equal(
    rentalDayHasAvailability({ dayHours: saturdayHours, blocks: [], booked: [], capacity: 1, step: 60, needSlots: 12 }),
    true,
  );
});

test("shorter open day is unavailable when part of it is already booked", () => {
  assert.equal(
    rentalDayHasAvailability({
      dayHours: saturdayHours,
      blocks: [],
      booked: [{ start_time: "09:00", end_time: "10:00" }],
      capacity: 1,
      step: 60,
      needSlots: 12,
    }),
    false,
  );
});

test("hourly request needs a contiguous free run", () => {
  assert.equal(
    rentalDayHasAvailability({
      dayHours: weekdayHours,
      blocks: [],
      booked: [{ start_time: "12:00", end_time: "13:00" }],
      capacity: 1,
      step: 60,
      needSlots: 4,
    }),
    true, // 13:00–21:00 is a free run of 8
  );
  assert.equal(
    rentalDayHasAvailability({
      dayHours: [{ start_time: "09:00", end_time: "12:00" }],
      blocks: [],
      booked: [{ start_time: "10:00", end_time: "11:00" }],
      capacity: 1,
      step: 60,
      needSlots: 2,
    }),
    false, // no 2 contiguous free hours
  );
});

test("a closed day (no hours) is never available", () => {
  assert.equal(
    rentalDayHasAvailability({ dayHours: [], blocks: [], booked: [], capacity: 1, step: 60, needSlots: 1 }),
    false,
  );
});

test("a full-day block makes the day unavailable", () => {
  assert.equal(
    rentalDayHasAvailability({
      dayHours: weekdayHours,
      blocks: [{ start_time: null, end_time: null }],
      booked: [],
      capacity: 1,
      step: 60,
      needSlots: 1,
    }),
    false,
  );
});
