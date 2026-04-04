import type { Metadata } from "next";
import { PostHogProvider } from "@/components/analytics";
import { DemoBanner } from "@/components/demo-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ClinicPay — Singapore Payroll Platform",
    template: "%s | ClinicPay",
  },
  description:
    "Automated CPF calculations, PDPA-compliant data protection, and effortless pay runs for Singapore SMEs. Free for up to 5 employees.",
  keywords: [
    "singapore payroll",
    "cpf calculator",
    "payroll software",
    "hr software singapore",
    "giro payment",
    "ir8a filing",
    "pdpa compliant",
    "employee management",
  ],
  authors: [{ name: "ClinicPay" }],
  creator: "ClinicPay",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://clinicpay.sg"),
  openGraph: {
    type: "website",
    locale: "en_SG",
    siteName: "ClinicPay",
    title: "ClinicPay — Singapore Payroll Platform",
    description:
      "Automated CPF calculations, PDPA-compliant data protection, and effortless pay runs for Singapore SMEs.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ClinicPay — Singapore Payroll Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClinicPay — Singapore Payroll Platform",
    description: "Automated CPF, PDPA security, 7 bank GIRO formats. Free for up to 5 employees.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <DemoBanner />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
