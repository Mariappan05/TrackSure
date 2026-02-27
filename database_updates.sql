-- Add new columns to orders table for fuel monitoring and tracking
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS actual_distance FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel_consumed_liters FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Create fuel_rates table for vehicle-specific fuel consumption
CREATE TABLE IF NOT EXISTS fuel_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_type TEXT NOT NULL UNIQUE,
  km_per_liter FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default fuel rates (average consumption)
INSERT INTO fuel_rates (vehicle_type, km_per_liter) VALUES
  ('bike', 40.0),    -- 40 km/liter
  ('car', 15.0),     -- 15 km/liter
  ('van', 10.0),     -- 10 km/liter
  ('truck', 6.0)     -- 6 km/liter
ON CONFLICT (vehicle_type) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
