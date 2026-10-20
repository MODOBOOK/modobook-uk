import { describe, expect, test } from "vitest";
import { rentalDayHasAvailability } from "./room-rental-availability";

const weekdayHours = [{ start_time: "09:00", end_time: "21:00" }]; // 12h
const saturdayHours = [{ start_time: "09:00", end_time: "17:00" }]; // 8h

describe("rentalDayHasAvailability", () => {
  test("full-day request (12 slots) fits a 12-hour weekday", () => {
    expect(
      rentalDayHasAvailability({ dayHours: weekdayHours, blocks: [], booked: [], capacity: 1, step: 60, needSlots: 12 }),
    ).toBe(true);
  });

  test("full-day request (12 slots) still books a shorter 8-hour Saturday when fully free", () => {
    expect(
      rentalDayHasAvailability({ dayHours: saturdayHours, blocks: [], booked: [], capacity: 1, step: 60, needSlots: 12 }),
    ).toBe(true);
  });

  test("shorter open day is unavailable when part of it is already booked", () => {
    expect(
      rentalDayHasAvailability({
        dayHours: saturdayHours,
        blocks: [],
        booked: [{ start_time: "09:00", end_time: "10:00" }],
        capacity: 1,
        step: 60,
        needSlots: 12,
      }),
    ).toBe(false);
  });

  test("hourly request needs a contiguous free run", () => {
    expect(
      rentalDayHasAvailability({
        dayHours: weekdayHours,
        blocks: [],
        booked: [{ start_time: "12:00", end_time: "13:00" }],
        capacity: 1,
        step: 60,
        needSlots: 4,
      }),
    ).toBe(true); // 13:00–21:00 is a free run of 8
    expect(
      rentalDayHasAvailability({
        dayHours: [{ start_time: "09:00", end_time: "12:00" }],
        blocks: [],
        booked: [{ start_time: "10:00", end_time: "11:00" }],
        capacity: 1,
        step: 60,
        needSlots: 2,
      }),
    ).toBe(false); // no 2 contiguous free hours
  });

  test("a closed day (no hours) is never available", () => {
    expect(
      rentalDayHasAvailability({ dayHours: [], blocks: [], booked: [], capacity: 1, step: 60, needSlots: 1 }),
    ).toBe(false);
  });

  test("a full-day block makes the day unavailable", () => {
    expect(
      rentalDayHasAvailability({
        dayHours: weekdayHours,
        blocks: [{ start_time: null, end_time: null }],
        booked: [],
        capacity: 1,
        step: 60,
        needSlots: 1,
      }),
    ).toBe(false);
  });
});
