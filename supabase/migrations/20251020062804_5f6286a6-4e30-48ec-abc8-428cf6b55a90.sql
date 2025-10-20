-- Fix 1: Payment Bypass - Update quiz_attempts INSERT policy to verify payment
DROP POLICY IF EXISTS "Users can create own attempts" ON quiz_attempts;

CREATE POLICY "Users can create attempts with valid payment" 
ON quiz_attempts FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.payments 
    WHERE public.payments.id = quiz_attempts.payment_id 
    AND public.payments.user_id = auth.uid()
    AND public.payments.quiz_id = quiz_attempts.quiz_id
    AND public.payments.status = 'success'
  )
);

-- Fix 2: Add foreign key constraint for payment_id
ALTER TABLE quiz_attempts
ADD CONSTRAINT fk_quiz_attempts_payment
FOREIGN KEY (payment_id) REFERENCES payments(id);

-- Fix 3: Prevent modification of submitted quiz attempts
DROP POLICY IF EXISTS "Users can update own attempts" ON quiz_attempts;

CREATE POLICY "Users can update unsubmitted attempts" 
ON quiz_attempts FOR UPDATE
USING (auth.uid() = user_id AND submitted_at IS NULL);

-- Fix 4: Add score validation constraint
ALTER TABLE quiz_attempts 
ADD CONSTRAINT valid_score CHECK (score >= 0 AND score <= 1000);

-- Fix 5: Missing RLS policies on payments table
CREATE POLICY "Only admins can update payments" 
ON payments FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Prevent payment deletion" 
ON payments FOR DELETE
USING (false);

-- Fix 6: Drop and recreate quiz_questions_public view to exclude correct answers
DROP VIEW IF EXISTS quiz_questions_public;

CREATE VIEW quiz_questions_public AS
SELECT 
  id,
  quiz_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  question_order,
  category,
  created_at
FROM quiz_questions;