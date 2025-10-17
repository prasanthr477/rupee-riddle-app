import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

const Admin = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [quizData, setQuizData] = useState({
    quiz_date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    entry_fee: 1.00,
    prize_amount: 0.00,
  });
  const [questions, setQuestions] = useState<any[]>([{
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    category: '',
  }]);

  useEffect(() => {
    if (!user || !isAdmin) {
      toast.error('Access denied');
      navigate('/dashboard');
    }
  }, [user, isAdmin, navigate]);

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      category: '',
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    if (!quizData.title || questions.some(q => !q.question_text)) {
      toast.error('Please fill all required fields');
      return;
    }

    const { data: quiz, error: quizError } = await supabase
      .from('daily_quizzes')
      .insert([quizData])
      .select()
      .single();

    if (quizError) {
      toast.error('Error creating quiz');
      return;
    }

    const questionsToInsert = questions.map((q, index) => ({
      ...q,
      quiz_id: quiz.id,
      question_order: index + 1,
    }));

    const { error: questionsError } = await supabase
      .from('quiz_questions')
      .insert(questionsToInsert);

    if (questionsError) {
      toast.error('Error adding questions');
    } else {
      toast.success('Quiz created successfully!');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <Button onClick={() => navigate('/dashboard')} variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Create Daily Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quiz Date</Label>
                <Input
                  type="date"
                  value={quizData.quiz_date}
                  onChange={(e) => setQuizData({ ...quizData, quiz_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Entry Fee (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quizData.entry_fee}
                  onChange={(e) => setQuizData({ ...quizData, entry_fee: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quiz Title</Label>
              <Input
                value={quizData.title}
                onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                placeholder="e.g., Daily GK Quiz - January 15"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={quizData.description}
                onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                placeholder="Brief description of the quiz"
              />
            </div>

            <div className="space-y-2">
              <Label>Prize Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={quizData.prize_amount}
                onChange={(e) => setQuizData({ ...quizData, prize_amount: parseFloat(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Questions</h2>
          <Button onClick={addQuestion} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>

        {questions.map((question, index) => (
          <Card key={index} className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Question {index + 1}</CardTitle>
                {questions.length > 1 && (
                  <Button
                    onClick={() => removeQuestion(index)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Textarea
                  value={question.question_text}
                  onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                  placeholder="Enter your question"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Option A</Label>
                  <Input
                    value={question.option_a}
                    onChange={(e) => updateQuestion(index, 'option_a', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Option B</Label>
                  <Input
                    value={question.option_b}
                    onChange={(e) => updateQuestion(index, 'option_b', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Option C</Label>
                  <Input
                    value={question.option_c}
                    onChange={(e) => updateQuestion(index, 'option_c', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Option D</Label>
                  <Input
                    value={question.option_d}
                    onChange={(e) => updateQuestion(index, 'option_d', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Correct Option</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={question.correct_option}
                    onChange={(e) => updateQuestion(index, 'correct_option', e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={question.category}
                    onChange={(e) => updateQuestion(index, 'category', e.target.value)}
                    placeholder="e.g., General Knowledge"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button onClick={handleSubmit} className="w-full bg-gradient-success text-lg py-6">
          Create Quiz
        </Button>
      </div>
    </div>
  );
};

export default Admin;
