import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, IndianRupee, Clock, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { HomeButton } from '@/components/HomeButton';
import { AnnouncementsBanner } from '@/components/AnnouncementsBanner';
import { getDeviceFingerprint } from '@/utils/deviceFingerprint';

const Dashboard = () => {
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [todayQuiz, setTodayQuiz] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [quizAttempt, setQuizAttempt] = useState<any>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');

  useEffect(() => {
    loadTodayQuiz();
    initDeviceFingerprint();
  }, []);

  useEffect(() => {
    if (todayQuiz && deviceFingerprint) {
      checkPaymentStatus();
      checkQuizAttempt();
    }
  }, [todayQuiz, user, deviceFingerprint]);

  const initDeviceFingerprint = async () => {
    const fp = await getDeviceFingerprint();
    setDeviceFingerprint(fp);
  };

  const loadTodayQuiz = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('quiz_date', today)
      .eq('is_active', true)
      .maybeSingle();
    
    setTodayQuiz(data);
  };

  const checkPaymentStatus = async () => {
    if (!todayQuiz) return;
    
    let query = supabase
      .from('payments')
      .select('*')
      .eq('quiz_id', todayQuiz.id)
      .eq('status', 'success');
    
    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.eq('device_fingerprint', deviceFingerprint).eq('is_anonymous', true);
    }
    
    const { data } = await query.maybeSingle();
    setPaymentStatus(data);
  };

  const checkQuizAttempt = async () => {
    if (!todayQuiz) return;
    
    let query = supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', todayQuiz.id);
    
    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.eq('device_fingerprint', deviceFingerprint).eq('is_anonymous', true);
    }
    
    const { data } = await query.maybeSingle();
    setQuizAttempt(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <HomeButton />
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-gold bg-clip-text text-transparent flex items-center gap-2">
              <Trophy className="h-8 w-8 text-secondary" />
              ₹1 Daily Quiz
            </h1>
            <p className="text-muted-foreground">
              {user ? `Welcome back, ${user.email}` : 'Welcome, Guest User'}
            </p>
          </div>
          <div className="flex gap-2">
            {!user && (
              <Button onClick={() => navigate('/auth')} variant="outline">
                Sign Up
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => navigate('/admin')} variant="outline">
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </Button>
            )}
            {user && (
              <Button onClick={signOut} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>

        <AnnouncementsBanner />

        {!todayQuiz ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Quiz Available Today</h3>
                <p className="text-muted-foreground">Check back tomorrow for the next quiz!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                {todayQuiz.title}
              </CardTitle>
              <CardDescription>{todayQuiz.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-3 bg-secondary/10 rounded-lg">
                  <IndianRupee className="h-5 w-5 text-secondary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Entry Fee</p>
                    <p className="font-bold">₹{todayQuiz.entry_fee}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-lg">
                  <Trophy className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm text-muted-foreground">Prize Pool</p>
                    <p className="font-bold">₹{todayQuiz.prize_amount}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Results Announced At</p>
                  <p className="font-bold">{todayQuiz.results_time} IST</p>
                </div>
              </div>

              {quizAttempt?.submitted_at ? (
                <div className="text-center py-6 bg-accent/10 rounded-lg">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-accent" />
                  <h3 className="text-xl font-semibold mb-2">Quiz Completed!</h3>
                  <p className="text-muted-foreground mb-2">
                    Your Score: {quizAttempt.score} points
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Results will be published at {todayQuiz.results_time} IST
                  </p>
                  <Button
                    onClick={() => navigate('/leaderboard')}
                    className="mt-4 bg-gradient-primary"
                  >
                    View Leaderboard
                  </Button>
                </div>
              ) : paymentStatus ? (
                <Button
                  onClick={() => navigate('/quiz')}
                  className="w-full bg-gradient-primary text-lg py-6"
                >
                  Start Quiz Now
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/payment', { state: { quizId: todayQuiz.id, deviceFingerprint } })}
                  className="w-full bg-gradient-gold text-lg py-6"
                >
                  <IndianRupee className="mr-2 h-5 w-5" />
                  Pay ₹{todayQuiz.entry_fee} to Start
                </Button>
              )}
              
              {!user && (
                <p className="text-sm text-muted-foreground text-center">
                  💡 <strong>Tip:</strong> Sign up to receive notifications for quiz starts & winners!
                </p>
              )}

              <Button
                onClick={() => navigate('/leaderboard')}
                variant="outline"
                className="w-full"
              >
                <Trophy className="mr-2 h-4 w-4" />
                View Leaderboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
