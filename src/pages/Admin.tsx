import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Sparkles, RefreshCw, Edit2, Check, X } from 'lucide-react';
import { HomeButton } from '@/components/HomeButton';

interface Question {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  category: string;
}

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
  const [questions, setQuestions] = useState<Question[]>([{
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    category: '',
  }]);
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [importing, setImporting] = useState(false);
  
  // AI Generation state
  const [aiTopic, setAiTopic] = useState('');
  const [aiCategory, setAiCategory] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [selectedForRegeneration, setSelectedForRegeneration] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedQuestion, setEditedQuestion] = useState<Question | null>(null);

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
    const newSelected = new Set(selectedForRegeneration);
    newSelected.delete(index);
    setSelectedForRegeneration(newSelected);
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const toggleQuestionSelection = (index: number) => {
    const newSelected = new Set(selectedForRegeneration);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedForRegeneration(newSelected);
  };

  const startEditingQuestion = (index: number) => {
    setEditingIndex(index);
    setEditedQuestion({ ...questions[index] });
  };

  const cancelEditingQuestion = () => {
    setEditingIndex(null);
    setEditedQuestion(null);
  };

  const saveEditedQuestion = () => {
    if (editingIndex !== null && editedQuestion) {
      const updated = [...questions];
      updated[editingIndex] = editedQuestion;
      setQuestions(updated);
      setEditingIndex(null);
      setEditedQuestion(null);
      toast.success('Question updated');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!aiTopic) {
      toast.error('Please enter a topic');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
        body: {
          topic: aiTopic,
          category: aiCategory || 'General',
          count: aiQuestionCount,
        },
      });

      if (error) throw error;

      if (data.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        toast.success(`Generated ${data.questions.length} questions!`);
        setSelectedForRegeneration(new Set());
      } else {
        toast.error('Invalid response from AI');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSelected = async () => {
    if (selectedForRegeneration.size === 0) {
      toast.error('Please select questions to regenerate');
      return;
    }

    setGenerating(true);
    try {
      const questionsToRegenerate = Array.from(selectedForRegeneration).map(i => questions[i]);
      
      const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
        body: {
          topic: aiTopic,
          category: aiCategory || 'General',
          regenerateQuestions: questionsToRegenerate,
        },
      });

      if (error) throw error;

      if (data.questions && Array.isArray(data.questions)) {
        const updated = [...questions];
        const selectedArray = Array.from(selectedForRegeneration).sort((a, b) => a - b);
        
        selectedArray.forEach((originalIndex, i) => {
          if (data.questions[i]) {
            updated[originalIndex] = data.questions[i];
          }
        });

        setQuestions(updated);
        setSelectedForRegeneration(new Set());
        toast.success(`Regenerated ${data.questions.length} questions!`);
      } else {
        toast.error('Invalid response from AI');
      }
    } catch (error: any) {
      console.error('Regeneration error:', error);
      toast.error(error.message || 'Failed to regenerate questions');
    } finally {
      setGenerating(false);
    }
  };

  const handleImportFromSheets = async () => {
    if (!sheetsUrl) {
      toast.error('Please enter a Google Sheets URL');
      return;
    }

    if (!quizData.title) {
      toast.error('Please fill in quiz title');
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-quiz-from-sheets', {
        body: {
          spreadsheetUrl: sheetsUrl,
          quizDate: quizData.quiz_date,
          title: quizData.title,
          description: quizData.description,
          entryFee: quizData.entry_fee,
          prizeAmount: quizData.prize_amount,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Quiz imported! ${data.questionsCount} questions added.`);
        navigate('/dashboard');
      } else {
        toast.error(data.error || 'Failed to import quiz');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import from Google Sheets');
    } finally {
      setImporting(false);
    }
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
      <HomeButton />
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <Button onClick={() => navigate('/dashboard')} variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button onClick={() => navigate('/announcements')} variant="outline">
            📢 Manage Announcements
          </Button>
        </div>

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

        <Card className="shadow-lg border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Quiz Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Topic *</Label>
                <Input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., World History, Science, Cricket"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  placeholder="e.g., General Knowledge"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Number of Questions</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(parseInt(e.target.value) || 10)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleGenerateQuestions} 
                disabled={generating}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {generating ? 'Generating...' : 'Generate Questions with AI'}
              </Button>
              {selectedForRegeneration.size > 0 && (
                <Button
                  onClick={handleRegenerateSelected}
                  disabled={generating}
                  variant="outline"
                  className="border-purple-500 text-purple-500 hover:bg-purple-500/10"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Selected ({selectedForRegeneration.size})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 Import from Google Sheets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Google Sheets URL</Label>
              <Input
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
              <p className="text-sm text-muted-foreground">
                Sheet should have columns: Question | Option A | Option B | Option C | Option D | Correct (A/B/C/D) | Category
              </p>
            </div>
            <Button 
              onClick={handleImportFromSheets} 
              disabled={importing}
              className="w-full bg-gradient-primary"
            >
              {importing ? 'Importing...' : 'Import Quiz from Sheets'}
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Questions ({questions.length})</h2>
          <Button onClick={addQuestion} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>

        {questions.map((question, index) => (
          <Card key={index} className="shadow-lg relative">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {questions.length > 1 && (
                    <Checkbox
                      checked={selectedForRegeneration.has(index)}
                      onCheckedChange={() => toggleQuestionSelection(index)}
                    />
                  )}
                  <CardTitle>Question {index + 1}</CardTitle>
                </div>
                <div className="flex gap-2">
                  {editingIndex === index ? (
                    <>
                      <Button onClick={saveEditedQuestion} size="sm" variant="default">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button onClick={cancelEditingQuestion} size="sm" variant="outline">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => startEditingQuestion(index)} size="sm" variant="outline">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {questions.length > 1 && (
                        <Button
                          onClick={() => removeQuestion(index)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingIndex === index && editedQuestion ? (
                <>
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Textarea
                      value={editedQuestion.question_text}
                      onChange={(e) => setEditedQuestion({ ...editedQuestion, question_text: e.target.value })}
                      placeholder="Enter your question"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Option A</Label>
                      <Input
                        value={editedQuestion.option_a}
                        onChange={(e) => setEditedQuestion({ ...editedQuestion, option_a: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option B</Label>
                      <Input
                        value={editedQuestion.option_b}
                        onChange={(e) => setEditedQuestion({ ...editedQuestion, option_b: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option C</Label>
                      <Input
                        value={editedQuestion.option_c}
                        onChange={(e) => setEditedQuestion({ ...editedQuestion, option_c: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option D</Label>
                      <Input
                        value={editedQuestion.option_d}
                        onChange={(e) => setEditedQuestion({ ...editedQuestion, option_d: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Correct Option</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={editedQuestion.correct_option}
                        onChange={(e) => setEditedQuestion({ ...editedQuestion, correct_option: e.target.value })}
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
                        value={editedQuestion.category}
                        onChange={(e) => setEditedQuestion({ ...editedQuestion, category: e.target.value })}
                        placeholder="e.g., General Knowledge"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <p className="p-3 bg-muted rounded-md min-h-[80px]">{question.question_text || <span className="text-muted-foreground">No question text</span>}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Option A {question.correct_option === 'A' && <span className="text-green-500">✓</span>}</Label>
                      <p className="p-2 bg-muted rounded-md">{question.option_a || <span className="text-muted-foreground">-</span>}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Option B {question.correct_option === 'B' && <span className="text-green-500">✓</span>}</Label>
                      <p className="p-2 bg-muted rounded-md">{question.option_b || <span className="text-muted-foreground">-</span>}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Option C {question.correct_option === 'C' && <span className="text-green-500">✓</span>}</Label>
                      <p className="p-2 bg-muted rounded-md">{question.option_c || <span className="text-muted-foreground">-</span>}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Option D {question.correct_option === 'D' && <span className="text-green-500">✓</span>}</Label>
                      <p className="p-2 bg-muted rounded-md">{question.option_d || <span className="text-muted-foreground">-</span>}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Category:</span> {question.category || <span className="text-muted-foreground">Not set</span>}
                    </div>
                  </div>
                </>
              )}
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
