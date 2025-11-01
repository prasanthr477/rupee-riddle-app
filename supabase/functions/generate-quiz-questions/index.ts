import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, category, count = 10, regenerateQuestions = [] } = await req.json();
    
    console.log('Generating questions for:', { topic, category, count, regenerateQuestions });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let prompt = '';
    if (regenerateQuestions.length > 0) {
      prompt = `Generate ${regenerateQuestions.length} new multiple-choice quiz questions about "${topic}" in the category "${category}". 
      
These questions should be different from the following existing questions:
${regenerateQuestions.map((q: any, i: number) => `${i + 1}. ${q.question_text}`).join('\n')}

Each question must have:
- A clear, well-written question
- 4 options labeled A, B, C, D
- One correct answer
- Be educational and factually accurate

Return ONLY a valid JSON array with no additional text, in this exact format:
[
  {
    "question_text": "Question here?",
    "option_a": "First option",
    "option_b": "Second option", 
    "option_c": "Third option",
    "option_d": "Fourth option",
    "correct_option": "A"
  }
]`;
    } else {
      prompt = `Generate ${count} multiple-choice quiz questions about "${topic}" in the category "${category}".

Each question must have:
- A clear, well-written question
- 4 options labeled A, B, C, D
- One correct answer
- Be educational and factually accurate

Return ONLY a valid JSON array with no additional text, in this exact format:
[
  {
    "question_text": "Question here?",
    "option_a": "First option",
    "option_b": "Second option",
    "option_c": "Third option", 
    "option_d": "Fourth option",
    "correct_option": "A"
  }
]`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a quiz generator. Always respond with valid JSON arrays only, no additional text or formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    
    console.log('Raw AI response:', generatedText);

    // Clean up the response - remove markdown code blocks if present
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '');
    }
    
    const questions = JSON.parse(cleanedText);
    
    console.log('Parsed questions:', questions);

    // Validate the structure
    if (!Array.isArray(questions)) {
      throw new Error('Generated content is not an array');
    }

    for (const q of questions) {
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
        throw new Error('Invalid question structure');
      }
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-quiz-questions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate questions';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
