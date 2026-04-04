import { describe, it, expect } from "vitest";
import { calculateCrc16, generatePayNowQrString } from "@/lib/bank/paynow-qr";

describe("PayNow QR Code Generator", () => {
  describe("calculateCrc16", () => {
    it("should calculate CRC-16/CCITT-FALSE correctly for a known input", () => {
      // Known test vector: "123456789" should produce CRC 0x29B1
      expect(calculateCrc16("123456789")).toBe("29B1");
    });

    it("should return 4-character uppercase hex string", () => {
      const result = calculateCrc16("test");
      expect(result).toMatch(/^[0-9A-F]{4}$/);
    });

    it("should produce different checksums for different inputs", () => {
      const crc1 = calculateCrc16("hello");
      const crc2 = calculateCrc16("world");
      expect(crc1).not.toBe(crc2);
    });
  });

  describe("generatePayNowQrString", () => {
    it("should generate a valid EMVCo QR string with UEN proxy", () => {
      const qrString = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        amount: 1234.56,
        reference: "SAL-2026-03",
        merchantName: "CLINICPAY PTE LTD",
        editable: false,
      });

      // Should start with Payload Format Indicator (tag 00, len 02, val "01")
      // then Point of Initiation (tag 01, len 02, val "12")
      expect(qrString).toMatch(/^00020101021226/);

      // Should contain PayNow reverse domain
      expect(qrString).toContain("SG.PAYNOW");

      // Should contain proxy type "2" for UEN
      expect(qrString).toContain("0102");

      // Should contain UEN value
      expect(qrString).toContain("201234567A");

      // Should contain currency 702 (SGD)
      expect(qrString).toContain("5303702");

      // Should contain amount
      expect(qrString).toContain("1234.56");

      // Should contain country SG
      expect(qrString).toContain("5802SG");

      // Should contain merchant city Singapore
      expect(qrString).toContain("6009Singapore");

      // Should end with CRC (6304 + 4 hex chars)
      expect(qrString).toMatch(/6304[0-9A-F]{4}$/);
    });

    it("should omit amount tag when amount is not provided", () => {
      const qrString = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        merchantName: "TEST",
      });

      // Tag 54 should not be present
      expect(qrString).not.toMatch(/54\d{2}\d+\.\d{2}/);
    });

    it("should include reference in additional data field", () => {
      const qrString = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        reference: "INV-001",
      });

      // Tag 62 should contain the reference
      expect(qrString).toContain("INV-001");
    });

    it("should set editable flag correctly", () => {
      const editableQr = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        editable: true,
      });

      const nonEditableQr = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        editable: false,
      });

      // Editable flag "1" vs "0" in sub-tag 03
      expect(editableQr).toContain("0301" + "1");
      expect(nonEditableQr).toContain("0301" + "0");
    });

    it("should use correct proxy type codes", () => {
      const mobileQr = generatePayNowQrString({
        proxyType: "MOBILE",
        proxyValue: "+6591234567",
      });
      // Sub-tag 01 value "0" for MOBILE
      expect(mobileQr).toContain("01010");

      const uenQr = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
      });
      // Sub-tag 01 value "2" for UEN
      expect(uenQr).toContain("01012");
    });

    it("should produce a valid CRC at the end", () => {
      const qrString = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        amount: 100.0,
        merchantName: "TEST COMPANY",
      });

      // Extract everything before the last 4 chars (the CRC value)
      const payload = qrString.slice(0, -4);
      const expectedCrc = calculateCrc16(payload);
      const actualCrc = qrString.slice(-4);

      expect(actualCrc).toBe(expectedCrc);
    });

    it("should truncate merchant name to 25 characters", () => {
      const longName = "THIS IS A VERY LONG COMPANY NAME THAT EXCEEDS LIMIT";
      const qrString = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        merchantName: longName,
      });

      // The full long name should NOT appear
      expect(qrString).not.toContain(longName);
      // But the truncated version should
      expect(qrString).toContain(longName.substring(0, 25));
    });

    it("should format amount with exactly 2 decimal places", () => {
      const qrString = generatePayNowQrString({
        proxyType: "UEN",
        proxyValue: "201234567A",
        amount: 100,
      });

      expect(qrString).toContain("100.00");
    });
  });
});
