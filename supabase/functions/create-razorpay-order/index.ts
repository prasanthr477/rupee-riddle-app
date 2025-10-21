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

    const { quizId } = await req.json();
    console.log('Creating Razorpay order for user:', user.id, 'quiz:', quizId);

    // Fetch actual quiz details from database to prevent amount manipulation
    const { data: quiz, error: quizError } = await supabaseClient
      .from('daily_quizzes')
      .select('entry_fee, is_active')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      console.error('Quiz not found:', quizError);
      throw new Error('Quiz not found');
    }

    if (!quiz.is_active) {
      throw new Error('Quiz is not active');
    }

    // Use database amount only - never trust client input
    const amount = quiz.entry_fee;
    console.log('Using quiz entry fee from database:', amount);

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    // Create Razorpay order
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt: `quiz_${quizId}_${Date.now()}`,
      }),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error('Razorpay order creation failed:', error);
      throw new Error('Failed to create Razorpay order');
    }

    const order = await orderResponse.json();
    console.log('Razorpay order created:', order.id);

    // Create payment record in database
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: user.id,
        quiz_id: quizId,
        amount: amount,
        order_id: order.id,
        status: 'pending',
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError);
      throw paymentError;
    }

    console.log('Payment record created:', payment.id);

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId,
        paymentId: payment.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create-razorpay-order:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
