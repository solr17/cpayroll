import { describe, it, expect } from "vitest";
import { determineShgFund, calculateShg } from "@/lib/payroll/shg";
import type { ShgFundType } from "@/lib/payroll/shg";

describe("determineShgFund", () => {
  it("returns CDAC for Chinese", () => {
    expect(determineShgFund("Chinese")).toBe("CDAC");
  });

  it("returns SINDA for Indian", () => {
    expect(determineShgFund("Indian")).toBe("SINDA");
  });

  it("returns MBMF for Malay", () => {
    expect(determineShgFund("Malay")).toBe("MBMF");
  });

  it("returns MBMF for Muslim religion regardless of race", () => {
    expect(determineShgFund("Other", "Muslim")).toBe("MBMF");
  });

  it("returns MBMF for Muslim religion even with null race", () => {
    expect(determineShgFund(null, "Muslim")).toBe("MBMF");
  });

  it("returns ECF for Eurasian", () => {
    expect(determineShgFund("Eurasian")).toBe("ECF");
  });

  it("returns NONE for Other race without Muslim religion", () => {
    expect(determineShgFund("Other")).toBe("NONE");
  });

  it("returns NONE for null race", () => {
    expect(determineShgFund(null)).toBe("NONE");
  });

  it("is case insensitive for race", () => {
    expect(determineShgFund("CHINESE")).toBe("CDAC");
    expect(determineShgFund("chinese")).toBe("CDAC");
    expect(determineShgFund("ChInEsE")).toBe("CDAC");
  });

  it("is case insensitive for religion", () => {
    expect(determineShgFund("Other", "MUSLIM")).toBe("MBMF");
    expect(determineShgFund("Other", "muslim")).toBe("MBMF");
  });

  it("trims whitespace from race", () => {
    expect(determineShgFund("  Chinese  ")).toBe("CDAC");
  });

  it("trims whitespace from religion", () => {
    expect(determineShgFund("Other", "  Muslim  ")).toBe("MBMF");
  });

  it("returns NONE for empty string race", () => {
    expect(determineShgFund("")).toBe("NONE");
  });

  it("Malay race takes priority even without Muslim religion param", () => {
    expect(determineShgFund("Malay", null)).toBe("MBMF");
  });
});

describe("calculateShg — CDAC bands", () => {
  const fund: ShgFundType = "CDAC";

  it("returns 0 for wages below floor ($500)", () => {
    expect(calculateShg(fund, 49_999, false)).toEqual({ fundType: "CDAC", contributionCents: 0 });
  });

  it("returns 0 at exactly $500 (50000 cents)", () => {
    expect(calculateShg(fund, 50_000, false)).toEqual({ fundType: "CDAC", contributionCents: 0 });
  });

  it("returns $0.50 at $500.01", () => {
    expect(calculateShg(fund, 50_001, false)).toEqual({ fundType: "CDAC", contributionCents: 50 });
  });

  it("returns $0.50 at exactly $1000", () => {
    expect(calculateShg(fund, 100_000, false)).toEqual({ fundType: "CDAC", contributionCents: 50 });
  });

  it("returns $1.00 at $1000.01", () => {
    expect(calculateShg(fund, 100_001, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 100,
    });
  });

  it("returns $1.50 at $2000.01", () => {
    expect(calculateShg(fund, 200_001, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 150,
    });
  });

  it("returns $3.00 at $3500.01", () => {
    expect(calculateShg(fund, 350_001, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 300,
    });
  });

  it("returns $4.50 at $5000.01", () => {
    expect(calculateShg(fund, 500_001, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 450,
    });
  });

  it("returns $6.00 at $7500.01", () => {
    expect(calculateShg(fund, 750_001, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 600,
    });
  });

  it("returns $8.00 above $10000", () => {
    expect(calculateShg(fund, 1_000_001, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 800,
    });
  });

  it("returns $8.00 for very high wages", () => {
    expect(calculateShg(fund, 99_999_999, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 800,
    });
  });
});

describe("calculateShg — SINDA bands", () => {
  const fund: ShgFundType = "SINDA";

  it("returns 0 at exactly $1000", () => {
    expect(calculateShg(fund, 100_000, false)).toEqual({ fundType: "SINDA", contributionCents: 0 });
  });

  it("returns $1.00 at $1000.01", () => {
    expect(calculateShg(fund, 100_001, false)).toEqual({
      fundType: "SINDA",
      contributionCents: 100,
    });
  });

  it("returns $3.00 at $1500.01", () => {
    expect(calculateShg(fund, 150_001, false)).toEqual({
      fundType: "SINDA",
      contributionCents: 300,
    });
  });

  it("returns $9.00 above $7500", () => {
    expect(calculateShg(fund, 750_001, false)).toEqual({
      fundType: "SINDA",
      contributionCents: 900,
    });
  });
});

describe("calculateShg — MBMF bands", () => {
  const fund: ShgFundType = "MBMF";

  it("returns 0 at exactly $1000", () => {
    expect(calculateShg(fund, 100_000, false)).toEqual({ fundType: "MBMF", contributionCents: 0 });
  });

  it("returns $2.00 at $1000.01", () => {
    expect(calculateShg(fund, 100_001, false)).toEqual({
      fundType: "MBMF",
      contributionCents: 200,
    });
  });

  it("returns $22.00 above $10000", () => {
    expect(calculateShg(fund, 1_000_001, false)).toEqual({
      fundType: "MBMF",
      contributionCents: 2_200,
    });
  });
});

describe("calculateShg — ECF bands", () => {
  const fund: ShgFundType = "ECF";

  it("returns 0 at exactly $500", () => {
    expect(calculateShg(fund, 50_000, false)).toEqual({ fundType: "ECF", contributionCents: 0 });
  });

  it("returns $1.50 at $500.01", () => {
    expect(calculateShg(fund, 50_001, false)).toEqual({ fundType: "ECF", contributionCents: 150 });
  });

  it("returns $6.00 above $5000", () => {
    expect(calculateShg(fund, 500_001, false)).toEqual({ fundType: "ECF", contributionCents: 600 });
  });
});

describe("calculateShg — special cases", () => {
  it("returns 0 when opted out", () => {
    expect(calculateShg("CDAC", 500_000, true)).toEqual({ fundType: "CDAC", contributionCents: 0 });
  });

  it("returns 0 for NONE fund type", () => {
    expect(calculateShg("NONE", 500_000, false)).toEqual({
      fundType: "NONE",
      contributionCents: 0,
    });
  });

  it("returns 0 for zero wages", () => {
    expect(calculateShg("CDAC", 0, false)).toEqual({ fundType: "CDAC", contributionCents: 0 });
  });

  it("returns 0 for negative wages", () => {
    expect(calculateShg("CDAC", -100_000, false)).toEqual({
      fundType: "CDAC",
      contributionCents: 0,
    });
  });

  it("returns 0 when NONE and opted out", () => {
    expect(calculateShg("NONE", 500_000, true)).toEqual({ fundType: "NONE", contributionCents: 0 });
  });
});
