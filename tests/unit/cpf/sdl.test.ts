import { describe, it, expect } from "vitest";
import { calculateSdl } from "@/lib/payroll/sdl";

describe("SDL calculation", () => {
  it("returns 0 for zero wages", () => {
    expect(calculateSdl(0).sdlCents).toBe(0);
  });

  it("applies floor of $2 for low wages", () => {
    // S$500: 500 * 0.0025 = 1.25 → floor applies → $2 = 200 cents
    expect(calculateSdl(50000).sdlCents).toBe(200);
  });

  it("calculates normally between floor and ceiling", () => {
    // S$2,000: 2000 * 0.0025 = 5.00 = 500 cents
    expect(calculateSdl(200000).sdlCents).toBe(500);
  });

  it("applies ceiling of $11.25 for high wages", () => {
    // S$10,000: 10000 * 0.0025 = 25.00 → ceiling applies → $11.25 = 1125 cents
    expect(calculateSdl(1000000).sdlCents).toBe(1125);
  });

  it("returns exactly $11.25 at $4,500", () => {
    // S$4,500: 4500 * 0.0025 = 11.25 = 1125 cents (exactly at ceiling)
    expect(calculateSdl(450000).sdlCents).toBe(1125);
  });

  it("returns floor for wages below $800", () => {
    // S$700: 700 * 0.0025 = 1.75 → floor of $2
    expect(calculateSdl(70000).sdlCents).toBe(200);
  });

  it("returns 0 for negative wages", () => {
    expect(calculateSdl(-10000).sdlCents).toBe(0);
  });
});
