-- Allow anonymous quiz attempts by making user_id nullable
ALTER TABLE public.quiz_attempts
ALTER COLUMN user_id DROP NOT NULL;