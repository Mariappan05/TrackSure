-- Add signature and delivery notes to delivery_proofs table
ALTER TABLE delivery_proofs
ADD COLUMN IF NOT EXISTS signature_data TEXT,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Add vehicle type to orders table for fuel calculation
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) DEFAULT 'bike';

-- Add comment for vehicle types
COMMENT ON COLUMN orders.vehicle_type IS 'Vehicle type: bike, car, van';
