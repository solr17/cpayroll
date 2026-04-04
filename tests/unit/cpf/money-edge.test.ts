import { describe, it, expect } from "vitest";
import {
  centsToDisplay,
  centsToCurrency,
  displayToCents,
  multiplyByRate,
  addCents,
  subtractCents,
  prorateCents,
  overtimeHourlyRateCents,
} from "@/lib/utils/money";

describe("centsToDisplay", () => {
  it("formats zero cents", () => {
    expect(centsToDisplay(0)).toBe("0.00");
  });

  it("formats small amounts", () => {
    expect(centsToDisplay(1)).toBe("0.01");
    expect(centsToDisplay(99)).toBe("0.99");
  });

  it("formats negative amounts", () => {
    expect(centsToDisplay(-12345)).toBe("-123.45");
  });

  it("formats very large amounts (billions of cents)", () => {
    const result = centsToDisplay(1_000_000_000_00); // 1 billion dollars
    expect(result).toContain(".00");
    // Should contain the number with comma formatting
    expect(result.endsWith(".00")).toBe(true);
  });
});

describe("centsToCurrency", () => {
  it("prepends S$ prefix", () => {
    expect(centsToCurrency(123456)).toMatch(/^S\$/);
  });

  it("formats zero with prefix", () => {
    expect(centsToCurrency(0)).toBe("S$0.00");
  });
});

describe("displayToCents", () => {
  it("parses standard format", () => {
    expect(displayToCents("1,234.56")).toBe(123456);
  });

  it("parses without commas", () => {
    expect(displayToCents("1234.56")).toBe(123456);
  });

  it("parses whole dollars (no decimal)", () => {
    expect(displayToCents("100")).toBe(10000);
  });

  it("parses negative values", () => {
    expect(displayToCents("-50.00")).toBe(-5000);
  });

  it("parses currency-prefixed string", () => {
    expect(displayToCents("S$1,234.56")).toBe(123456);
  });

  it("parses zero", () => {
    expect(displayToCents("0")).toBe(0);
  });

  it("parses single cent decimal like 0.01", () => {
    expect(displayToCents("0.01")).toBe(1);
  });
});

describe("multiplyByRate", () => {
  it("floors correctly", () => {
    expect(multiplyByRate(1000, 0.175, "floor")).toBe(175);
    expect(multiplyByRate(999, 0.175, "floor")).toBe(174); // 174.825 -> 174
  });

  it("ceils correctly", () => {
    expect(multiplyByRate(999, 0.175, "ceil")).toBe(175); // 174.825 -> 175
  });

  it("rounds correctly", () => {
    expect(multiplyByRate(1000, 0.175, "round")).toBe(175);
    expect(multiplyByRate(999, 0.175, "round")).toBe(175); // 174.825 -> 175
  });

  it("handles zero cents", () => {
    expect(multiplyByRate(0, 0.2, "round")).toBe(0);
  });

  it("handles zero rate", () => {
    expect(multiplyByRate(500000, 0, "round")).toBe(0);
  });

  it("handles very large amounts", () => {
    const result = multiplyByRate(10_000_000_00, 0.2, "round"); // $10M * 20%
    expect(result).toBe(200_000_000);
  });
});

describe("addCents", () => {
  it("adds multiple values", () => {
    expect(addCents(100, 200, 300)).toBe(600);
  });

  it("handles zero values", () => {
    expect(addCents(0, 0, 0)).toBe(0);
  });

  it("handles negative values", () => {
    expect(addCents(1000, -500)).toBe(500);
  });

  it("handles single value", () => {
    expect(addCents(42)).toBe(42);
  });

  it("handles no arguments", () => {
    expect(addCents()).toBe(0);
  });
});

describe("subtractCents", () => {
  it("subtracts correctly", () => {
    expect(subtractCents(1000, 300)).toBe(700);
  });

  it("can produce negative result", () => {
    expect(subtractCents(100, 500)).toBe(-400);
  });

  it("subtracting zero is identity", () => {
    expect(subtractCents(1000, 0)).toBe(1000);
  });
});

describe("prorateCents", () => {
  it("prorates 1 day of 31", () => {
    expect(prorateCents(310_000, 1, 31)).toBe(10_000);
  });

  it("prorates 30 of 30 days (full month)", () => {
    expect(prorateCents(500_000, 30, 30)).toBe(500_000);
  });

  it("prorates 15 of 30 days (half month)", () => {
    expect(prorateCents(500_000, 15, 30)).toBe(250_000);
  });

  it("rounds down the result", () => {
    // 100000 * 1 / 3 = 33333.33... → 33333
    expect(prorateCents(100_000, 1, 3)).toBe(33_333);
  });

  it("handles zero days worked", () => {
    expect(prorateCents(500_000, 0, 30)).toBe(0);
  });

  it("handles very large salary", () => {
    const result = prorateCents(50_000_000, 15, 30); // $500k salary, half month
    expect(result).toBe(25_000_000);
  });
});

describe("overtimeHourlyRateCents", () => {
  it("calculates 1.5x OT rate per MOM formula", () => {
    // basicSalary / (26*8) * 1.5
    // 500000 / 208 * 1.5 = 3605.769... → 3606 (rounded)
    expect(overtimeHourlyRateCents(500_000, 1.5)).toBe(3606);
  });

  it("calculates 1x rate", () => {
    // 500000 / 208 = 2403.846... → 2404
    expect(overtimeHourlyRateCents(500_000, 1)).toBe(2404);
  });

  it("returns 0 for zero salary", () => {
    expect(overtimeHourlyRateCents(0, 1.5)).toBe(0);
  });

  it("returns 0 for zero multiplier", () => {
    expect(overtimeHourlyRateCents(500_000, 0)).toBe(0);
  });
});
