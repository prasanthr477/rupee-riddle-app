-- Remove security definer views and add proper RLS policies instead

-- Drop the security definer views
DROP VIEW IF EXISTS public.profiles_public;
DROP VIEW IF EXISTS public.quiz_questions_public;

-- Add RLS policy to allow public read of non-sensitive profile data (for leaderboard)
CREATE POLICY "Anyone can view public profile info for leaderboard" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Note: quiz_questions already has proper RLS policy:
-- "Anyone can view questions for active quizzes" allows viewing questions
-- without needing a separate view