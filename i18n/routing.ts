import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "hi", "as"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
