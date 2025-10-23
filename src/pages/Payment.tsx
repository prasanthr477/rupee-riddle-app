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
import { getDeviceFingerprint } from '@/utils/deviceFingerprint';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const guestInfoSchema = z.object({
  guestName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  guestEmail: z.string().email('Invalid email address').max(255, 'Email too long'),
  guestPhone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
});

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
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [guestInfoProvided, setGuestInfoProvided] = useState(!!user);
  const [guestInfo, setGuestInfo] = useState<any>(null);

  const quizId = location.state?.quizId;
  const passedFingerprint = location.state?.deviceFingerprint;

  const form = useForm<z.infer<typeof guestInfoSchema>>({
    resolver: zodResolver(guestInfoSchema),
    defaultValues: {
      guestName: '',
      guestEmail: '',
      guestPhone: '',
    },
  });

  useEffect(() => {
    if (!quizId) {
      navigate('/dashboard');
      return;
    }
    initFingerprint();
    loadQuiz();
  }, [navigate, quizId]);

  const initFingerprint = async () => {
    const fp = passedFingerprint || await getDeviceFingerprint();
    setDeviceFingerprint(fp);
  };

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

  const onGuestInfoSubmit = (values: z.infer<typeof guestInfoSchema>) => {
    setGuestInfo(values);
    setGuestInfoProvided(true);
  };

  const handlePayment = async () => {
    if (!quiz || !deviceFingerprint) return;
    if (!user && !guestInfo) {
      toast({
        title: 'Guest Information Required',
        description: 'Please provide your contact information',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create Razorpay order - amount is fetched server-side for security
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            quizId: quiz.id,
            deviceFingerprint: deviceFingerprint,
            isAnonymous: !user,
            guestName: guestInfo?.guestName,
            guestEmail: guestInfo?.guestEmail,
            guestPhone: guestInfo?.guestPhone,
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
                deviceFingerprint: deviceFingerprint,
                isAnonymous: !user,
                guestName: guestInfo?.guestName,
                guestEmail: guestInfo?.guestEmail,
                guestPhone: guestInfo?.guestPhone,
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
          name: user ? '' : guestInfo?.guestName,
          email: user?.email || guestInfo?.guestEmail,
          contact: user ? '' : guestInfo?.guestPhone,
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
                {!user && !guestInfoProvided ? (
                  <>
                    <Alert>
                      <AlertDescription>
                        As a guest, please provide your contact information so we can reach you if you win!
                      </AlertDescription>
                    </Alert>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onGuestInfoSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="guestName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="guestEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="your@email.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="guestPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="10-digit phone number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button type="submit" className="w-full">
                          Continue to Payment
                        </Button>
                      </form>
                    </Form>
                  </>
                ) : (
                  <>
                    <div className="text-center py-8 border-2 border-dashed border-secondary/30 rounded-lg bg-secondary/5">
                      <IndianRupee className="h-16 w-16 mx-auto mb-4 text-secondary" />
                      <p className="text-3xl font-bold mb-2">₹{quiz.entry_fee}</p>
                      <p className="text-muted-foreground">Entry Fee</p>
                    </div>

                    {!user && guestInfo && (
                      <div className="text-sm text-muted-foreground space-y-1 p-4 bg-secondary/5 rounded-lg">
                        <p><strong>Name:</strong> {guestInfo.guestName}</p>
                        <p><strong>Email:</strong> {guestInfo.guestEmail}</p>
                        <p><strong>Phone:</strong> {guestInfo.guestPhone}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setGuestInfoProvided(false)}
                          className="mt-2"
                        >
                          Edit Information
                        </Button>
                      </div>
                    )}

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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
