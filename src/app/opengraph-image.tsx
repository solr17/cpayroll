import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "ClinicPay — Singapore Payroll Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        fontFamily: "sans-serif",
      }}
    >
      {/* Logo circle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
          marginBottom: 32,
        }}
      >
        <span style={{ fontSize: 56, fontWeight: 800, color: "#ffffff" }}>CP</span>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: "#ffffff",
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        ClinicPay
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 32,
          color: "#94a3b8",
          margin: "12px 0 0 0",
          lineHeight: 1.4,
        }}
      >
        Singapore Payroll Platform
      </p>

      {/* Features line */}
      <p
        style={{
          fontSize: 22,
          color: "#38bdf8",
          margin: "40px 0 0 0",
          letterSpacing: "0.05em",
        }}
      >
        CPF Compliant &bull; PDPA Secure &bull; 7 Banks Supported
      </p>
    </div>,
    { ...size },
  );
}
