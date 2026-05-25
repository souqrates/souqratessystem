import type { IntegrationAdapter } from "./types";
import { ALL_ADAPTERS } from "./adapters";

const bySlug = new Map<string, IntegrationAdapter>();
for (const a of ALL_ADAPTERS) {
  if (bySlug.has(a.slug)) {
    throw new Error(`duplicate integration adapter slug: ${a.slug}`);
  }
  bySlug.set(a.slug, a);
}

export function listAdapters(): IntegrationAdapter[] {
  return ALL_ADAPTERS.slice().sort((a, b) =>
    a.tier !== b.tier ? a.tier - b.tier : a.slug.localeCompare(b.slug),
  );
}

export function getAdapter(slug: string): IntegrationAdapter | undefined {
  return bySlug.get(slug);
}
