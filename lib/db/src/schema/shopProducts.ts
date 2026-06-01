import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  numeric,
  index,
} from "drizzle-orm/pg-core";

export const shopProductsTable = pgTable(
  "shop_products",
  {
    id: serial("id").primaryKey(),
    categorySlug: text("category_slug").notNull().default("books"),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    priceSkz: numeric("price_skz", { precision: 18, scale: 6 }).notNull(),
    coverUrl: text("cover_url"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCategory: index("shop_products_category_idx").on(t.categorySlug),
    byActive: index("shop_products_active_idx").on(t.isActive),
  }),
);

export type ShopProduct = typeof shopProductsTable.$inferSelect;
