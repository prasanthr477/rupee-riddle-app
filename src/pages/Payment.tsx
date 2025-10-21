import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IndianRupee, ArrowLeft } from 'lucide-react';
import { HomeButton } from '@/components/HomeButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Payment = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);

  const quizId = location.state?.quizId;

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!quizId) {
      navigate('/dashboard');
      return;
    }
    loadQuiz();
  }, [user, navigate, quizId]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
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
    if (!quiz || !user) return;

    setLoading(true);
    try {
      // Create Razorpay order - amount is fetched server-side for security
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            quizId: quiz.id,
          },
        }
      );

      if (orderError) throw orderError;

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
            description: 'You can now start the quiz',
          });
          navigate('/dashboard');
        },
        prefill: {
          email: user.email,
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

                <Button
                  onClick={handlePayment}
                  disabled={loading || !quiz}
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
