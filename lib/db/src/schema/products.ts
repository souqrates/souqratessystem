import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const productCategoriesTable = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    icon: text("icon").notNull().default("📚"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqSlug: uniqueIndex("product_categories_slug_uniq").on(t.slug),
  }),
);

export const digitalProductsTable = pgTable(
  "digital_products",
  {
    id: serial("id").primaryKey(),
    publisherTelegramId: bigint("publisher_telegram_id", { mode: "bigint" }).notNull(),
    categoryId: integer("category_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    priceUsdt: numeric("price_usdt", { precision: 18, scale: 6 }).notNull(),
    // pending | approved | rejected | disabled
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    salesCount: integer("sales_count").notNull().default(0),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    byStatus: index("digital_products_status_idx").on(t.status),
    byCategory: index("digital_products_category_idx").on(t.categoryId),
    byPublisher: index("digital_products_publisher_idx").on(t.publisherTelegramId),
  }),
);

export const productPurchasesTable = pgTable(
  "product_purchases",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    buyerTelegramId: bigint("buyer_telegram_id", { mode: "bigint" }).notNull(),
    pricePaid: numeric("price_paid", { precision: 18, scale: 6 }).notNull(),
    commissionAmount: numeric("commission_amount", { precision: 18, scale: 6 }).notNull(),
    netToPublisher: numeric("net_to_publisher", { precision: 18, scale: 6 }).notNull(),
    transactionId: integer("transaction_id"),
    downloadToken: text("download_token").notNull(),
    downloadExpiresAt: timestamp("download_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqToken: uniqueIndex("product_purchases_token_uniq").on(t.downloadToken),
    byBuyer: index("product_purchases_buyer_idx").on(t.buyerTelegramId),
    byProduct: index("product_purchases_product_idx").on(t.productId),
  }),
);

export type ProductCategory = typeof productCategoriesTable.$inferSelect;
export type DigitalProduct = typeof digitalProductsTable.$inferSelect;
export type ProductPurchase = typeof productPurchasesTable.$inferSelect;
