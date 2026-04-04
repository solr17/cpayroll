/**
 * PayNow QR Code Generator
 *
 * Generates EMVCo-compliant QR code strings for Singapore's PayNow system.
 * Follows the SGQR specification with CRC-16/CCITT-FALSE checksum.
 *
 * References:
 * - EMVCo QR Code Specification for Payment Systems (Merchant-Presented Mode)
 * - Singapore Quick Response Code (SGQR) specification
 */

import QRCode from "qrcode";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PayNowQrData {
  /** How to identify the recipient */
  proxyType: "UEN" | "MOBILE" | "NRIC";
  /** UEN, phone number (+65XXXXXXXX), or NRIC */
  proxyValue: string;
  /** Amount in dollars (optional — omit for open amount) */
  amount?: number;
  /** Transaction reference / bill number */
  reference?: string;
  /** Company or merchant name */
  merchantName?: string;
  /** Whether the amount can be edited by the payer (default false) */
  editable?: boolean;
  /** Expiry date in YYYYMMDD format (optional) */
  expiryDate?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PROXY_TYPE_MAP: Record<PayNowQrData["proxyType"], string> = {
  MOBILE: "0",
  UEN: "2",
  NRIC: "1", // Not commonly used but part of spec
};

const PAYLOAD_FORMAT_INDICATOR = "01";
const POINT_OF_INITIATION_DYNAMIC = "12";
const PAYNOW_REVERSE_DOMAIN = "SG.PAYNOW";
const MERCHANT_CATEGORY_CODE = "0000";
const CURRENCY_SGD = "702";
const COUNTRY_SG = "SG";
const MERCHANT_CITY = "Singapore";

// ─── TLV Helpers ────────────────────────────────────────────────────────────

/**
 * Build a TLV (Tag-Length-Value) field.
 * Tag is a 2-digit string, length is 2-digit zero-padded, value is the content.
 */
function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${tag}${length}${value}`;
}

// ─── CRC-16/CCITT-FALSE ────────────────────────────────────────────────────

/**
 * Calculate CRC-16/CCITT-FALSE checksum.
 * Polynomial: 0x1021, Initial value: 0xFFFF.
 *
 * This is CRITICAL for PayNow QR — wrong checksum means the QR won't scan.
 */
export function calculateCrc16(str: string): string {
  let crc = 0xffff;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ─── QR String Generator ───────────────────────────────────────────────────

/**
 * Generate a PayNow QR payload string following EMVCo + SGQR specification.
 *
 * TLV structure:
 * - Tag 00: Payload Format Indicator ("01")
 * - Tag 01: Point of Initiation ("12" for dynamic)
 * - Tag 26: Merchant Account Info (PayNow sub-tags)
 * - Tag 52: Merchant Category Code ("0000")
 * - Tag 53: Transaction Currency ("702" for SGD)
 * - Tag 54: Transaction Amount (if specified)
 * - Tag 58: Country Code ("SG")
 * - Tag 59: Merchant Name
 * - Tag 60: Merchant City ("Singapore")
 * - Tag 62: Additional Data (reference)
 * - Tag 63: CRC-16 checksum (always last)
 */
export function generatePayNowQrString(data: PayNowQrData): string {
  const proxyTypeCode = PROXY_TYPE_MAP[data.proxyType];
  const editableFlag = data.editable ? "1" : "0";
  const merchantName = (data.merchantName ?? "COMPANY").substring(0, 25);

  // Build Merchant Account Information (Tag 26) sub-fields
  let merchantAccountInfo = "";
  merchantAccountInfo += tlv("00", PAYNOW_REVERSE_DOMAIN);
  merchantAccountInfo += tlv("01", proxyTypeCode);
  merchantAccountInfo += tlv("02", data.proxyValue);
  merchantAccountInfo += tlv("03", editableFlag);
  if (data.expiryDate) {
    merchantAccountInfo += tlv("04", data.expiryDate);
  }

  // Build main payload (without CRC)
  let payload = "";
  payload += tlv("00", PAYLOAD_FORMAT_INDICATOR);
  payload += tlv("01", POINT_OF_INITIATION_DYNAMIC);
  payload += tlv("26", merchantAccountInfo);
  payload += tlv("52", MERCHANT_CATEGORY_CODE);
  payload += tlv("53", CURRENCY_SGD);

  // Tag 54: Amount (optional, formatted as dollars with 2 decimal places)
  if (data.amount !== undefined && data.amount > 0) {
    const amountStr = data.amount.toFixed(2);
    payload += tlv("54", amountStr);
  }

  payload += tlv("58", COUNTRY_SG);
  payload += tlv("59", merchantName);
  payload += tlv("60", MERCHANT_CITY);

  // Tag 62: Additional data (reference)
  if (data.reference) {
    const additionalData = tlv("01", data.reference.substring(0, 25));
    payload += tlv("62", additionalData);
  }

  // Tag 63: CRC-16 — append the tag + length prefix before calculating
  // The CRC is calculated over the entire string including "6304"
  const crcInput = payload + "6304";
  const crc = calculateCrc16(crcInput);

  return crcInput + crc;
}

// ─── QR SVG Generator ──────────────────────────────────────────────────────

/**
 * Generate an SVG string of the PayNow QR code.
 * Uses the `qrcode` library for reliable QR encoding with error correction.
 */
export async function generatePayNowQrSvg(data: PayNowQrData, size: number = 256): Promise<string> {
  const qrString = generatePayNowQrString(data);

  const svg = await QRCode.toString(qrString, {
    type: "svg",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return svg;
}
