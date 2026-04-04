"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        // PDPA compliance: don't auto-capture PII
        autocapture: {
          dom_event_allowlist: ["click", "submit"],
          element_allowlist: ["a", "button", "form"],
        },
        // Strip PII from captured data
        sanitize_properties: (properties) => {
          // Remove any NRIC patterns
          for (const key of Object.keys(properties)) {
            if (typeof properties[key] === "string") {
              properties[key] = (properties[key] as string).replace(
                /[STFGM]\d{7}[A-Z]/gi,
                "[NRIC]",
              );
            }
          }
          return properties;
        },
      });
    }
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
