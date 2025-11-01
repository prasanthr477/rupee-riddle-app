import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, paymentId, signature, deviceFingerprint, isAnonymous, guestName, guestEmail, guestPhone } = await req.json();
    console.log('Verifying Razorpay payment:', { orderId, paymentId, isAnonymous });

    let userId = null;
    if (!isAnonymous) {
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
      userId = user.id;
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeySecret) {
      throw new Error('Razorpay secret not configured');
    }

    // Verify signature
    const text = `${orderId}|${paymentId}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(razorpayKeySecret);
    const algorithm = { name: "HMAC", hash: "SHA-256" };
    
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      algorithm,
      false,
      ["sign"]
    );
    
    const signatureData = await crypto.subtle.sign(
      algorithm.name,
      key,
      encoder.encode(text)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureData))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== signature) {
      console.error('Signature verification failed');
      throw new Error('Invalid payment signature');
    }

    console.log('Signature verified successfully');

    // First, find the payment record to verify it exists
    console.log('Looking for payment with order_id:', orderId);
    const { data: existingPayment, error: findError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (findError) {
      console.error('Error finding payment:', findError);
      throw new Error('Failed to find payment record');
    }

    if (!existingPayment) {
      console.error('Payment not found for order_id:', orderId);
      throw new Error('Payment record not found');
    }

    console.log('Found payment record:', existingPayment.id);

    // Update payment record
    const updateData: any = {
      payment_id: paymentId,
      signature: signature,
      status: 'success',
    };

    // Update guest info if provided (in case it wasn't set during order creation)
    if (isAnonymous && guestName && guestEmail && guestPhone) {
      updateData.guest_name = guestName;
      updateData.guest_email = guestEmail;
      updateData.guest_phone = guestPhone;
    }

    const { data: payment, error: updateError } = await supabaseClient
      .from('payments')
      .update(updateData)
      .eq('order_id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      throw updateError;
    }

    console.log('Payment verified and updated:', payment.id);

    return new Response(
      JSON.stringify({ success: true, payment }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in verify-razorpay-payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
