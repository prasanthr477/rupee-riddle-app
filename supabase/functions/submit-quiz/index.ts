import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { quizId, paymentId, answers, timeSpentSeconds } = await req.json();
    console.log('Submitting quiz:', { quizId, paymentId, userId: user.id });

    // Verify payment exists and is successful
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', user.id)
      .eq('quiz_id', quizId)
      .eq('status', 'success')
      .single();

    if (paymentError || !payment) {
      console.error('Invalid payment:', paymentError);
      throw new Error('Invalid or unpaid quiz access');
    }

    // Fetch quiz questions with correct answers
    const { data: questions, error: questionsError } = await supabaseClient
      .from('quiz_questions')
      .select('id, correct_option, question_order')
      .eq('quiz_id', quizId)
      .order('question_order');

    if (questionsError || !questions) {
      console.error('Failed to fetch questions:', questionsError);
      throw new Error('Failed to fetch quiz questions');
    }

    // Validate answers object structure
    if (!answers || typeof answers !== 'object') {
      throw new Error('Invalid answers format');
    }

    // Calculate score server-side
    let score = 0;
    const validatedAnswers: Record<string, string> = {};

    for (const question of questions) {
      const questionId = question.id;
      const userAnswer = answers[questionId];
      
      // Validate answer is A, B, C, or D
      if (userAnswer && ['A', 'B', 'C', 'D'].includes(userAnswer)) {
        validatedAnswers[questionId] = userAnswer;
        
        if (userAnswer === question.correct_option) {
          score += 1;
        }
      }
    }

    console.log('Calculated score:', score, 'out of', questions.length);

    // Validate time spent is reasonable (e.g., not negative, not more than 24 hours)
    const validTimeSpent = Math.max(0, Math.min(timeSpentSeconds, 86400));

    // Insert quiz attempt with validated data
    const { data: attempt, error: attemptError } = await supabaseClient
      .from('quiz_attempts')
      .insert({
        user_id: user.id,
        quiz_id: quizId,
        payment_id: paymentId,
        score: score,
        answers: validatedAnswers,
        time_spent_seconds: validTimeSpent,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Failed to insert attempt:', attemptError);
      throw attemptError;
    }

    console.log('Quiz submitted successfully:', attempt.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        attempt,
        score,
        totalQuestions: questions.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in submit-quiz:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
