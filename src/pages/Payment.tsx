import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IndianRupee, ArrowLeft, AlertCircle } from 'lucide-react';

const Payment = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handlePayment = async () => {
    setLoading(true);
    // Payment integration will be added
    // For now, navigate back to dashboard
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Razorpay payment integration is in progress. This is a placeholder page.
                Contact admin to set up Razorpay credentials.
              </AlertDescription>
            </Alert>

            <div className="text-center py-8 border-2 border-dashed border-secondary/30 rounded-lg bg-secondary/5">
              <IndianRupee className="h-16 w-16 mx-auto mb-4 text-secondary" />
              <p className="text-3xl font-bold mb-2">₹1.00</p>
              <p className="text-muted-foreground">Entry Fee</p>
            </div>

            <Button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-gradient-gold text-lg py-6"
            >
              {loading ? 'Processing...' : 'Pay with UPI'}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Secure payment powered by Razorpay
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
