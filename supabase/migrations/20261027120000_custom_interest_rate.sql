-- Add description field to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing settings with descriptions
UPDATE settings SET description = 'Default monthly interest rate (decimal, e.g., 0.05 = 5%)' WHERE key = 'monthly_rate' AND description IS NULL;
UPDATE settings SET description = 'Default repayment style for new loans' WHERE key = 'default_repayment_style' AND description IS NULL;
UPDATE settings SET description = 'Minimum loan amount allowed' WHERE key = 'min_loan_amount' AND description IS NULL;
UPDATE settings SET description = 'Maximum loan amount allowed' WHERE key = 'max_loan_amount' AND description IS NULL;
UPDATE settings SET description = 'Minimum loan term in months' WHERE key = 'min_term_months' AND description IS NULL;
UPDATE settings SET description = 'Maximum loan term in months' WHERE key = 'max_term_months' AND description IS NULL;
UPDATE settings SET description = 'Maximum income-to-payment ratio allowed (decimal, e.g., 0.20 = 20%)' WHERE key = 'income_ratio_limit' AND description IS NULL;
UPDATE settings SET description = 'Grace period before late payment penalties apply' WHERE key = 'grace_days' AND description IS NULL;
UPDATE settings SET description = 'Late payment penalty rate (decimal, e.g., 0.02 = 2%)' WHERE key = 'late_payment_penalty_rate' AND description IS NULL;

-- Add custom_rate field to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS custom_rate NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS rate_override_reason TEXT;

-- Add min_rate and max_rate settings
INSERT INTO settings (key, value, description, updated_at)
VALUES
  ('min_rate', '0.01', 'Minimum allowed monthly interest rate (decimal, e.g., 0.01 = 1%)', NOW()),
  ('max_rate', '0.10', 'Maximum allowed monthly interest rate (decimal, e.g., 0.10 = 10%)', NOW())
ON CONFLICT (key) DO NOTHING;
