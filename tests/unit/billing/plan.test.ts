import { describe, it, expect } from "vitest";
import { PLAN_TIERS, isValidPlanTier } from "@/lib/billing/plan";

describe("PLAN_TIERS", () => {
  it("free tier has employee limit of 5", () => {
    expect(PLAN_TIERS.free.employeeLimit).toBe(5);
  });

  it("free tier costs $0 per employee", () => {
    expect(PLAN_TIERS.free.pricePerEmployeeCents).toBe(0);
  });

  it("pro tier has employee limit of 50", () => {
    expect(PLAN_TIERS.pro.employeeLimit).toBe(50);
  });

  it("pro tier costs $5 (500 cents) per employee", () => {
    expect(PLAN_TIERS.pro.pricePerEmployeeCents).toBe(500);
  });

  it("enterprise tier has unlimited employees (Infinity)", () => {
    expect(PLAN_TIERS.enterprise.employeeLimit).toBe(Infinity);
  });

  it("enterprise tier costs $8 (800 cents) per employee", () => {
    expect(PLAN_TIERS.enterprise.pricePerEmployeeCents).toBe(800);
  });

  it("all tiers have a label property", () => {
    expect(PLAN_TIERS.free.label).toBe("Free");
    expect(PLAN_TIERS.pro.label).toBe("Pro");
    expect(PLAN_TIERS.enterprise.label).toBe("Enterprise");
  });

  it("has exactly three tiers", () => {
    expect(Object.keys(PLAN_TIERS)).toHaveLength(3);
  });
});

describe("isValidPlanTier", () => {
  it("returns true for 'free'", () => {
    expect(isValidPlanTier("free")).toBe(true);
  });

  it("returns true for 'pro'", () => {
    expect(isValidPlanTier("pro")).toBe(true);
  });

  it("returns true for 'enterprise'", () => {
    expect(isValidPlanTier("enterprise")).toBe(true);
  });

  it("returns false for unknown tier", () => {
    expect(isValidPlanTier("premium")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidPlanTier("")).toBe(false);
  });

  it("is case sensitive — 'Free' is not valid", () => {
    expect(isValidPlanTier("Free")).toBe(false);
  });
});
