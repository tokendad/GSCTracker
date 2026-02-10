-- Migration 003: Normalize Inventory and Sales (V3 Schema)
-- Description: Adds normalized scout_inventory table and links sales to products.
-- Date: 2026-02-08

-- 1. Create scout_inventory table
-- Replaces the hardcoded inventory columns in the profile table
CREATE TABLE scout_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    quantity INTEGER DEFAULT 0,
    "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("productId") REFERENCES cookie_products(id) ON DELETE CASCADE,
    UNIQUE("userId", "productId")
);

CREATE INDEX idx_scout_inventory_user ON scout_inventory("userId");
CREATE INDEX idx_scout_inventory_product ON scout_inventory("productId");

COMMENT ON TABLE scout_inventory IS 'Normalized inventory tracking per scout and product';

-- 2. Add productId to sales table
-- Links sales directly to the cookie product catalog
ALTER TABLE sales ADD COLUMN "productId" UUID;
ALTER TABLE sales ADD CONSTRAINT fk_sales_product FOREIGN KEY ("productId") REFERENCES cookie_products(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_product ON sales("productId");

COMMENT ON COLUMN sales."cookieType" IS 'DEPRECATED: Use productId instead';

-- 3. Data Migration (Best Effort)
-- Link sales to products based on name matching
-- Matches based on Cookie Name and Season (if available in sales)
-- Note: This requires cookie_products to be populated first.
UPDATE sales s
SET "productId" = cp.id
FROM cookie_products cp
WHERE s."cookieType" = cp."cookieName"
  AND (
      (s.season IS NOT NULL AND s.season = cp.season)
      OR 
      (s.season IS NULL) -- Fallback if sales.season is missing, might match multiple seasons if not careful, but usually unique enough for dev
  )
  AND s."productId" IS NULL;

-- 4. Migrate Profile Inventory (Optional / Conceptual)
-- We do not automatically migrate profile columns here because the application logic 
-- creates them dynamically. A separate script would be needed to pivot 
-- the flat 'inventoryThinMints' columns into rows in 'scout_inventory'.
