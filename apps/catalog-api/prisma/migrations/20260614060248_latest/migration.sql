-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "external_product_id" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "custom_title" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "shape" TEXT,
    "source_url" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "raw_source_hash" TEXT,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_options" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "option_group" TEXT NOT NULL,
    "option_key" TEXT NOT NULL,
    "option_label" TEXT NOT NULL,
    "option_value" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "price_data_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "variant_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_constraints" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "face_key" TEXT NOT NULL,
    "width_mm" DECIMAL,
    "height_mm" DECIMAL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "bleed_mm" DECIMAL,
    "safe_zone_mm" DECIMAL,
    "dpi" INTEGER,
    "panel_count" INTEGER,
    "cutline_required" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "constraints_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "layout_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "total_price" DECIMAL(12,4),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_runs" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "run_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "pages_fetched" INTEGER NOT NULL DEFAULT 0,
    "products_discovered" INTEGER NOT NULL DEFAULT 0,
    "products_updated" INTEGER NOT NULL DEFAULT 0,
    "parse_failures" INTEGER NOT NULL DEFAULT 0,
    "error_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_snapshots" (
    "id" UUID NOT NULL,
    "scrape_run_id" UUID NOT NULL,
    "product_id" UUID,
    "source_url" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "quote_request_id" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "input_options_json" JSONB NOT NULL,
    "pricing_inputs_json" JSONB NOT NULL,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "subtotal" DECIMAL(12,4) NOT NULL,
    "markup_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "risk_buffer_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,4) NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_slug_key" ON "catalog_products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_variant_code_key" ON "product_variants"("product_id", "variant_code");

-- CreateIndex
CREATE UNIQUE INDEX "variant_options_variant_id_option_group_option_key_key" ON "variant_options"("variant_id", "option_group", "option_key");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quote_request_id_key" ON "quotes"("quote_request_id");

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_constraints" ADD CONSTRAINT "layout_constraints_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_snapshots" ADD CONSTRAINT "raw_snapshots_scrape_run_id_fkey" FOREIGN KEY ("scrape_run_id") REFERENCES "scrape_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_snapshots" ADD CONSTRAINT "raw_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
