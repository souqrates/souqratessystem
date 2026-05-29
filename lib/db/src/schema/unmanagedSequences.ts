import { pgSequence } from "drizzle-orm/pg-core";

const intSeqOptions = {
  increment: 1,
  minValue: 1,
  maxValue: 2147483647,
  startWith: 1,
  cache: 1,
} as const;

export const policiesIdSeq = pgSequence("policies_id_seq", intSeqOptions);
export const platformLinksIdSeq = pgSequence("platform_links_id_seq", intSeqOptions);
export const xpEventsIdSeq = pgSequence("xp_events_id_seq", intSeqOptions);
export const xpRulesIdSeq = pgSequence("xp_rules_id_seq", intSeqOptions);
