-- Add guest contact information columns to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Add constraint to ensure anonymous payments have contact info
ALTER TABLE public.payments 
ADD CONSTRAINT check_anonymous_contact_info 
CHECK (
  (is_anonymous = false) OR 
  (is_anonymous = true AND guest_name IS NOT NULL AND guest_email IS NOT NULL AND guest_phone IS NOT NULL)
);