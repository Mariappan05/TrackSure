-- Add sequence column to orders table for multi-stop optimization
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT 1;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_driver_sequence ON orders(driver_id, sequence);
