import { describe, it, expect } from "vitest";
import { calculateFwl } from "@/lib/payroll/fwl";

describe("FWL calculation", () => {
  it("returns configured rate for foreign workers", () => {
    expect(calculateFwl("FW", 40000).fwlCents).toBe(40000);
  });

  it("returns 0 for Singapore citizens", () => {
    expect(calculateFwl("SC", 40000).fwlCents).toBe(0);
  });

  it("returns 0 for PRs", () => {
    expect(calculateFwl("PR1", 40000).fwlCents).toBe(0);
    expect(calculateFwl("PR2", 40000).fwlCents).toBe(0);
    expect(calculateFwl("PR3", 40000).fwlCents).toBe(0);
  });

  it("returns 0 rate when configured as 0", () => {
    expect(calculateFwl("FW", 0).fwlCents).toBe(0);
  });
});
