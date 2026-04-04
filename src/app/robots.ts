import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clinicpay.sg";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/payroll/", "/employees/", "/settings/", "/billing/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
