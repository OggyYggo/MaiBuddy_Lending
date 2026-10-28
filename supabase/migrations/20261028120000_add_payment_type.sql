-- Add payment_type column to payments table
ALTER TABLE payments
ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'principal'
CHECK (payment_type IN ('principal', 'interest', 'penalty'));

-- Update existing payments to principal
UPDATE payments SET payment_type = 'principal' WHERE payment_type IS NULL;
