# Fuel Monitoring & Distance Tracking Setup

## Database Setup Required

Run this SQL in your Supabase SQL Editor:

```sql
-- Add new columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS actual_distance FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel_consumed_liters FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Create fuel_rates table
CREATE TABLE IF NOT EXISTS fuel_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_type TEXT NOT NULL UNIQUE,
  km_per_liter FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default fuel rates
INSERT INTO fuel_rates (vehicle_type, km_per_liter) VALUES
  ('bike', 40.0),
  ('car', 15.0),
  ('van', 10.0),
  ('truck', 6.0)
ON CONFLICT (vehicle_type) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
```

## How It Works

### 1. Order Start
- Driver clicks "Start Delivery" in Order Details
- System records `started_at` timestamp
- Status changes to `in_progress`

### 2. During Delivery
- GPS tracks driver location every 15 seconds
- Locations stored in `driver_locations` table with `order_id`

### 3. Order Completion
- Driver submits delivery proof
- System automatically:
  - Calculates actual distance from GPS points
  - Calculates travel time (completed_at - started_at)
  - Calculates fuel consumption based on vehicle type
  - Updates order with all metrics

### 4. Admin Dashboard
- Shows planned vs actual distance
- Shows travel time
- Shows fuel consumed
- Color-coded: Green if actual ≤ 120% of planned, Red if exceeded

## Features Added

✅ **Actual Distance Tracking** - GPS-based distance calculation
✅ **Travel Time Tracking** - Start to completion time
✅ **Fuel Consumption** - Vehicle-specific fuel rates
✅ **Admin Dashboard Metrics** - All metrics visible on order cards
✅ **Order Details Enhanced** - Full metrics display
✅ **Delivery Completion Summary** - Shows metrics after delivery

## Fuel Rates (Default)

| Vehicle | km/Liter |
|---------|----------|
| Bike    | 40       |
| Car     | 15       |
| Van     | 10       |
| Truck   | 6        |

You can update these in Supabase:
```sql
UPDATE fuel_rates SET km_per_liter = 45 WHERE vehicle_type = 'bike';
```

## Testing

1. Run the SQL migration in Supabase
2. Create a new order
3. Driver accepts order
4. Driver clicks "Start Delivery"
5. Move around (or simulate GPS)
6. Complete delivery with proof
7. Check Admin Dashboard - metrics will show!
