-- Fix 1: Create a secure view for leaderboard profiles (only exposing full_name, not phone)
CREATE OR REPLACE VIEW profiles_public AS
SELECT id, full_name, created_at
FROM profiles;

GRANT SELECT ON profiles_public TO authenticated, anon;

-- Fix 2: Restrict profiles table to own profile only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Fix 3: Restrict user_roles to own role only
DROP POLICY IF EXISTS "Anyone can view user roles" ON public.user_roles;

CREATE POLICY "Users view own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Fix 4: Create a secure view for quiz questions (excluding correct_option)
CREATE OR REPLACE VIEW quiz_questions_public AS
SELECT 
  id, 
  quiz_id, 
  question_order, 
  question_text, 
  option_a, 
  option_b, 
  option_c, 
  option_d, 
  category, 
  created_at
FROM quiz_questions;

GRANT SELECT ON quiz_questions_public TO authenticated, anon;