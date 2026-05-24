export const TELEGRAM_BOT_USERNAME = "souqrates_souq_bot";
export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
export const TELEGRAM_PUBLISH_URL = `${TELEGRAM_BOT_URL}?start=publish`;
export const buyOnTelegram = (id: string | number) =>
  `${TELEGRAM_BOT_URL}?start=buy_${id}`;

export const CATEGORY_SLUGS = [
  "religion",
  "education",
  "literature",
  "kids",
  "self-development",
  "audio",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
