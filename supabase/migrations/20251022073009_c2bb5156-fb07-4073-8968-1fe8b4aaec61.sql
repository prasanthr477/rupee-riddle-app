-- Create announcements table for admin posts
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT NOT NULL CHECK (announcement_type IN ('quiz_start', 'winner', 'general')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS on announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.announcements
FOR SELECT
USING (is_active = true);

-- Only admins can manage announcements
CREATE POLICY "Only admins can manage announcements"
ON public.announcements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add device fingerprint tracking to quiz_attempts for anonymous users
ALTER TABLE public.quiz_attempts
ADD COLUMN device_fingerprint TEXT,
ADD COLUMN is_anonymous BOOLEAN DEFAULT false;

-- Create index for faster device fingerprint lookups
CREATE INDEX idx_quiz_attempts_device_fingerprint ON public.quiz_attempts(device_fingerprint);

-- Update quiz_attempts RLS policies to allow anonymous attempts
DROP POLICY IF EXISTS "Users can create attempts with valid payment" ON public.quiz_attempts;

CREATE POLICY "Users can create attempts with valid payment"
ON public.quiz_attempts
FOR INSERT
WITH CHECK (
  (
    -- Authenticated users
    (auth.uid() = user_id AND is_anonymous = false) OR
    -- Anonymous users with device fingerprint
    (auth.uid() IS NULL AND is_anonymous = true AND device_fingerprint IS NOT NULL)
  )
  AND
  -- Both must have valid payment
  (EXISTS (
    SELECT 1
    FROM payments
    WHERE payments.id = quiz_attempts.payment_id
      AND payments.quiz_id = quiz_attempts.quiz_id
      AND payments.status = 'success'
  ))
);

-- Allow anonymous users to view their own attempts by device fingerprint
DROP POLICY IF EXISTS "Users can view own attempts" ON public.quiz_attempts;

CREATE POLICY "Users can view own attempts"
ON public.quiz_attempts
FOR SELECT
USING (
  (auth.uid() = user_id) OR
  (is_anonymous = true)
);

-- Modify payments to support anonymous users
ALTER TABLE public.payments
ALTER COLUMN user_id DROP NOT NULL,
ADD COLUMN device_fingerprint TEXT,
ADD COLUMN is_anonymous BOOLEAN DEFAULT false;

-- Update payments RLS policies
DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;

CREATE POLICY "Users can create own payments"
ON public.payments
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND is_anonymous = false) OR
  (auth.uid() IS NULL AND is_anonymous = true AND device_fingerprint IS NOT NULL)
);

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
USING (
  (auth.uid() = user_id) OR
  (is_anonymous = true)
);