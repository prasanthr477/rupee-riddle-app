import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Clock, Trophy, ArrowRight } from 'lucide-react';

const Quiz = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeSpent, setTimeSpent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [todayQuiz, setTodayQuiz] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    loadQuiz();

    return () => clearInterval(timer);
  }, [user, navigate]);

  const loadQuiz = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: quiz } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('quiz_date', today)
      .eq('is_active', true)
      .single();

    if (!quiz) {
      toast.error('No quiz available today');
      navigate('/dashboard');
      return;
    }

    setTodayQuiz(quiz);

    const { data: questionsData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('question_order');

    if (questionsData) {
      setQuestions(questionsData);
    }
  };

  const handleSubmit = async () => {
    if (!user || !todayQuiz) return;
    
    setLoading(true);
    
    let score = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_option) {
        score += 10;
      }
    });

    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', user.id)
      .eq('quiz_id', todayQuiz.id)
      .eq('status', 'success')
      .single();

    if (!payment) {
      toast.error('Payment verification failed');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('quiz_attempts').upsert({
      user_id: user.id,
      quiz_id: todayQuiz.id,
      payment_id: payment.id,
      score,
      time_spent_seconds: timeSpent,
      answers,
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Error submitting quiz');
    } else {
      toast.success('Quiz submitted successfully!');
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (questions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center">Loading quiz...</div>;
  }

  const question = questions[currentQuestion];
  const isLastQuestion = currentQuestion === questions.length - 1;
  const hasAnswered = !!answers[question.id];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-sm">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">
                Question {currentQuestion + 1}/{questions.length}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-sm">
              <Clock className="h-5 w-5 text-secondary" />
              <span className="font-semibold">{formatTime(timeSpent)}</span>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              {question.question_text}
            </CardTitle>
            {question.category && (
              <p className="text-sm text-muted-foreground">Category: {question.category}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={answers[question.id]}
              onValueChange={(value) => setAnswers({ ...answers, [question.id]: value })}
            >
              <div className="space-y-3">
                {['A', 'B', 'C', 'D'].map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                    <Label
                      htmlFor={`${question.id}-${option}`}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="font-semibold mr-2">{option}.</span>
                      {question[`option_${option.toLowerCase()}`]}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <div className="flex gap-3">
              {currentQuestion > 0 && (
                <Button
                  onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  variant="outline"
                >
                  Previous
                </Button>
              )}
              
              {!isLastQuestion ? (
                <Button
                  onClick={() => setCurrentQuestion(currentQuestion + 1)}
                  className="ml-auto bg-gradient-primary"
                  disabled={!hasAnswered}
                >
                  Next Question
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || Object.keys(answers).length !== questions.length}
                  className="ml-auto bg-gradient-success"
                >
                  {loading ? 'Submitting...' : 'Submit Quiz'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quiz;
