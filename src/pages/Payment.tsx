import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IndianRupee, ArrowLeft } from 'lucide-react';
import { HomeButton } from '@/components/HomeButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getDeviceFingerprint } from '@/utils/deviceFingerprint';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Payment = () => {
  const { user } = useAuth();
  const { guestDetails } = useGuest();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const quizId = location.state?.quizId;
  const passedFingerprint = location.state?.deviceFingerprint;

  useEffect(() => {
    if (!quizId) {
      navigate('/dashboard');
      return;
    }
    
    // Redirect to guest registration if anonymous and no details
    if (!user && !guestDetails) {
      toast({
        title: "Guest Registration Required",
        description: "Please provide your details to continue",
        variant: "destructive"
      });
      navigate('/guest-register');
      return;
    }
    
    initFingerprint();
    loadQuiz();
  }, [navigate, quizId, user, guestDetails]);

  const initFingerprint = async () => {
    const fp = passedFingerprint || await getDeviceFingerprint();
    setDeviceFingerprint(fp);
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => setRazorpayLoaded(false);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const loadQuiz = async () => {
    const { data, error } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error || !data) {
      toast({
        title: 'Error',
        description: 'Failed to load quiz details',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }
    setQuiz(data);
  };

  const handlePayment = async () => {
    if (!quiz || !deviceFingerprint) return;
    if (!razorpayLoaded || !window.Razorpay) {
      toast({
        title: 'Payment Unavailable',
        description: 'Payment gateway is still loading. Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Prevent duplicates: check if already paid
      let payQuery = supabase
        .from('payments')
        .select('id')
        .eq('quiz_id', quiz.id)
        .eq('status', 'success');
      if (user) {
        payQuery = payQuery.eq('user_id', user.id);
      } else {
        payQuery = payQuery.eq('is_anonymous', true).eq('device_fingerprint', deviceFingerprint);
      }
      const { data: existingPaid } = await payQuery.maybeSingle();
      if (existingPaid) {
        toast({
          title: 'Already Paid',
          description: 'You have already completed payment for this quiz.',
          variant: 'destructive',
        });
        navigate('/quiz');
        setLoading(false);
        return;
      }

      // Block duplicate payments already in progress
      let pendingQuery = supabase
        .from('payments')
        .select('id')
        .eq('quiz_id', quiz.id)
        .eq('status', 'pending');
      if (user) {
        pendingQuery = pendingQuery.eq('user_id', user.id);
      } else {
        pendingQuery = pendingQuery.eq('is_anonymous', true).eq('device_fingerprint', deviceFingerprint);
      }
      const { data: existingPending } = await pendingQuery.maybeSingle();
      if (existingPending) {
        toast({
          title: 'Payment Already Initiated',
          description: 'A payment is already in progress. Please complete it or try again later.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Create Razorpay order - amount is fetched server-side for security
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            quizId: quiz.id,
            deviceFingerprint: deviceFingerprint,
            isAnonymous: !user,
            guestName: guestDetails?.name,
            guestEmail: guestDetails?.email,
            guestPhone: guestDetails?.phone,
          },
        }
      );

      if (orderError) {
        const errorMessage = orderData?.error || orderError.message || 'Failed to create payment order';
        
        // Handle specific error cases with user-friendly messages
        if (errorMessage.includes('Payment already completed')) {
          toast({
            title: 'Already Paid',
            description: 'You have already paid for this quiz. Please check your dashboard.',
            variant: 'destructive',
          });
        } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
          toast({
            title: 'Payment Already Initiated',
            description: 'A payment for this quiz is already in progress. Please try again later.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Payment Error',
            description: 'Unable to process your payment request. Please try again.',
            variant: 'destructive',
          });
        }
        setLoading(false);
        return;
      }

      // Check if the response itself contains an error
      if (orderData?.error) {
        const errorMessage = orderData.error;
        
        if (errorMessage.includes('Payment already completed')) {
          toast({
            title: 'Already Paid',
            description: 'You have already paid for this quiz. Please check your dashboard.',
            variant: 'destructive',
          });
        } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
          toast({
            title: 'Payment Already Initiated',
            description: 'A payment for this quiz is already in progress. Please try again later.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Payment Error',
            description: 'Unable to process your payment request. Please try again.',
            variant: 'destructive',
          });
        }
        setLoading(false);
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Daily Quiz',
        description: quiz.title,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          // Verify payment
          const { error: verifyError } = await supabase.functions.invoke(
            'verify-razorpay-payment',
            {
              body: {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                deviceFingerprint: deviceFingerprint,
                isAnonymous: !user,
                guestName: guestDetails?.name,
                guestEmail: guestDetails?.email,
                guestPhone: guestDetails?.phone,
              },
            }
          );

          if (verifyError) {
            toast({
              title: 'Payment Verification Failed',
              description: 'Please contact support',
              variant: 'destructive',
            });
            return;
          }

          toast({
            title: 'Payment Successful!',
            description: 'Redirecting to the quiz...'
          });
          navigate('/quiz');
        },
        prefill: {
          name: user ? '' : guestDetails?.name,
          email: user?.email || guestDetails?.email,
          contact: user ? '' : guestDetails?.phone,
        },
        theme: {
          color: '#F97316',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response: any) {
        toast({
          title: 'Payment Failed',
          description: response.error.description,
          variant: 'destructive',
        });
        setLoading(false);
      });
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <HomeButton />
      <div className="max-w-md mx-auto space-y-6 py-8">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <IndianRupee className="h-6 w-6 text-secondary" />
              Payment
            </CardTitle>
            <CardDescription>Complete your payment to start the quiz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!quiz ? (
              <p className="text-center">Loading quiz details...</p>
            ) : (
              <>
                <div className="text-center py-8 border-2 border-dashed border-secondary/30 rounded-lg bg-secondary/5">
                  <IndianRupee className="h-16 w-16 mx-auto mb-4 text-secondary" />
                  <p className="text-3xl font-bold mb-2">₹{quiz.entry_fee}</p>
                  <p className="text-muted-foreground">Entry Fee</p>
                </div>

                {!user && guestDetails && (
                  <div className="text-sm text-muted-foreground space-y-1 p-4 bg-secondary/5 rounded-lg">
                    <p><strong>Name:</strong> {guestDetails.name}</p>
                    <p><strong>Email:</strong> {guestDetails.email}</p>
                    <p><strong>Phone:</strong> {guestDetails.phone}</p>
                  </div>
                )}

                <Button
                  onClick={handlePayment}
                  disabled={loading || !quiz || !razorpayLoaded}
                  className="w-full bg-gradient-gold text-lg py-6"
                >
                  {loading ? 'Processing...' : 'Pay with Razorpay'}
                </Button>

                <p className="text-sm text-center text-muted-foreground">
                  Secure payment powered by Razorpay
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
