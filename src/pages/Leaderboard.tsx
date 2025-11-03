import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { HomeButton } from '@/components/HomeButton';

const Leaderboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [todayQuiz, setTodayQuiz] = useState<any>(null);
  const [resultsPublished, setResultsPublished] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const isResultsPublished = (quizDate: string, resultsTime: string) => {
    // Get current time in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    
    // Parse quiz date and results time
    const [year, month, day] = quizDate.split('-').map(Number);
    const [hours, minutes, seconds] = resultsTime.split(':').map(Number);
    
    // Create results publish time in IST
    const resultsDateTime = new Date(Date.UTC(year, month - 1, day, hours - 5, minutes - 30, seconds || 0));
    
    return istNow >= resultsDateTime;
  };

  const loadLeaderboard = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: quiz } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('quiz_date', today)
      .eq('is_active', true)
      .maybeSingle();

    if (!quiz) return;
    setTodayQuiz(quiz);

    const published = isResultsPublished(quiz.quiz_date, quiz.results_time);
    setResultsPublished(published);

    if (!published) return;

    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        profiles:user_id (
          full_name
        )
      `)
      .eq('quiz_id', quiz.id)
      .not('submitted_at', 'is', null)
      .order('score', { ascending: false })
      .order('time_spent_seconds', { ascending: true })
      .limit(10);

    if (attempts) {
      setLeaders(attempts);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-6 w-6 text-secondary animate-pulse-glow" />;
    if (index === 1) return <Medal className="h-6 w-6 text-muted-foreground" />;
    if (index === 2) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <HomeButton />
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/dashboard')} variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Trophy className="h-16 w-16 text-secondary animate-pulse-glow" />
            </div>
            <CardTitle className="text-3xl bg-gradient-gold bg-clip-text text-transparent">
              Today's Leaderboard
            </CardTitle>
            <CardDescription>
              {todayQuiz && `Results will be final at ${todayQuiz.results_time} IST`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resultsPublished ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 mx-auto mb-4 text-secondary animate-pulse" />
                <p className="text-xl font-semibold mb-2">Results Not Published Yet</p>
                <p className="text-muted-foreground">
                  Leaderboard will be visible after {todayQuiz?.results_time} IST
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Come back later to see the rankings!
                </p>
              </div>
            ) : leaders.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  No participants yet. Be the first to play!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaders.map((leader, index) => (
                  <div
                    key={leader.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      index === 0
                        ? 'bg-gradient-gold border-secondary shadow-lg'
                        : index === 1
                        ? 'bg-muted/50 border-muted'
                        : index === 2
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                        : 'bg-card border-border'
                    } ${user?.id === leader.user_id ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-center justify-center w-12">
                      {getRankIcon(index)}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${index < 3 ? 'text-lg' : ''}`}>
                        {leader.profiles?.full_name || 'Anonymous'}
                        {user?.id === leader.user_id && (
                          <span className="ml-2 text-sm text-primary">(You)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Trophy className="h-4 w-4" />
                          {leader.score} points
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTime(leader.time_spent_seconds)}
                        </span>
                      </div>
                    </div>
                    {index < 3 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Prize</p>
                        <p className="font-bold text-accent">
                          {index === 0 && '₹500'}
                          {index === 1 && '₹300'}
                          {index === 2 && '₹200'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;
