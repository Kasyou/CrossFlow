const migration = `
CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
CREATE INDEX IF NOT EXISTS idx_order_platform_id ON "order"(platform_id);
CREATE INDEX IF NOT EXISTS idx_order_order_time ON "order"(order_time);
CREATE INDEX IF NOT EXISTS idx_order_tracking ON "order"(tracking_number);
CREATE INDEX IF NOT EXISTS idx_order_sku ON "order"(sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_platform_order ON "order"(platform_id, platform_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_inventory ON inventory_log(product_id, warehouse_id, created_at);
CREATE INDEX IF NOT EXISTS idx_review_product ON product_review(product_id, review_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier ON purchase_order(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_status ON purchase_order(status);
CREATE INDEX IF NOT EXISTS idx_freight_status ON freight_shipment(status);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);
CREATE INDEX IF NOT EXISTS idx_product_platform_product ON product_platform(product_id, platform_id);
`;
export default migration;
