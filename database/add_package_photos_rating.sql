-- Add package condition photos to delivery_proofs table
ALTER TABLE delivery_proofs
ADD COLUMN IF NOT EXISTS package_before_photo TEXT,
ADD COLUMN IF NOT EXISTS package_after_photo TEXT;

-- Add customer rating to delivery_proofs table
ALTER TABLE delivery_proofs
ADD COLUMN IF NOT EXISTS customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
ADD COLUMN IF NOT EXISTS customer_feedback TEXT;

-- Add idle time tracking to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS idle_time_minutes INTEGER DEFAULT 0;
