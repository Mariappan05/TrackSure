-- Add CASCADE DELETE to driver_locations table
-- When an order is deleted, all associated driver_locations will be automatically deleted

ALTER TABLE driver_locations
DROP CONSTRAINT IF EXISTS driver_locations_order_id_fkey;

ALTER TABLE driver_locations
ADD CONSTRAINT driver_locations_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES orders(id)
ON DELETE CASCADE;
