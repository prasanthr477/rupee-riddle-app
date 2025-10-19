import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Question {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  category: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      throw new Error('Admin access required');
    }

    // Use service role key for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { spreadsheetUrl, quizDate, title, description, entryFee, prizeAmount } = await req.json();

    // Validate Google Sheets URL
    const validateSheetsUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && 
               parsed.hostname === 'docs.google.com' &&
               /\/d\/[a-zA-Z0-9-_]+/.test(parsed.pathname);
      } catch {
        return false;
      }
    };

    if (!validateSheetsUrl(spreadsheetUrl)) {
      throw new Error('Invalid Google Sheets URL. Must be a valid https://docs.google.com URL');
    }

    console.log('Importing quiz from Google Sheets:', { spreadsheetUrl, quizDate, title });

    // Extract spreadsheet ID from URL
    const spreadsheetIdMatch = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!spreadsheetIdMatch) {
      throw new Error('Invalid Google Sheets URL');
    }
    const spreadsheetId = spreadsheetIdMatch[1];

    // Get service account credentials
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      throw new Error('Google Service Account credentials not configured');
    }

    const credentials = JSON.parse(serviceAccountKey);

    // Get access token using JWT
    const token = await getAccessToken(credentials);

    // Fetch data from Google Sheets
    const range = 'Sheet1!A2:G'; // Assuming headers in row 1, data starts from row 2
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!sheetsResponse.ok) {
      const error = await sheetsResponse.text();
      console.error('Google Sheets API error:', error);
      throw new Error(`Failed to fetch data from Google Sheets: ${error}`);
    }

    const sheetsData = await sheetsResponse.json();
    const rows = sheetsData.values || [];

    if (rows.length === 0) {
      throw new Error('No data found in the spreadsheet');
    }

    console.log(`Found ${rows.length} questions in spreadsheet`);

    // Limit number of questions to prevent DoS
    const maxQuestions = 100;
    if (rows.length > maxQuestions) {
      throw new Error(`Too many questions. Maximum allowed: ${maxQuestions}`);
    }

    // Create quiz
    const { data: quiz, error: quizError } = await supabase
      .from('daily_quizzes')
      .insert({
        quiz_date: quizDate,
        title,
        description,
        entry_fee: entryFee,
        prize_amount: prizeAmount,
        is_active: true,
      })
      .select()
      .single();

    if (quizError) {
      console.error('Error creating quiz:', quizError);
      throw quizError;
    }

    console.log('Quiz created:', quiz.id);

    // Sanitize and validate imported data
    const sanitize = (text: string, maxLength: number = 500): string => {
      return String(text || '').trim().substring(0, maxLength);
    };

    const validateCorrectOption = (option: string): string => {
      const normalized = option.trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(normalized)) {
        throw new Error(`Invalid correct_option: ${option}. Must be A, B, C, or D`);
      }
      return normalized;
    };

    // Prepare questions
    const questions: Question[] = rows.map((row: string[], index: number) => ({
      quiz_id: quiz.id,
      question_order: index + 1,
      question_text: sanitize(row[0]),
      option_a: sanitize(row[1]),
      option_b: sanitize(row[2]),
      option_c: sanitize(row[3]),
      option_d: sanitize(row[4]),
      correct_option: validateCorrectOption(row[5]),
      category: row[6] ? sanitize(row[6], 100) : 'General',
    }));

    // Insert questions
    const { error: questionsError } = await supabase
      .from('quiz_questions')
      .insert(questions);

    if (questionsError) {
      console.error('Error inserting questions:', questionsError);
      // Rollback: delete the quiz
      await supabase.from('daily_quizzes').delete().eq('id', quiz.id);
      throw questionsError;
    }

    console.log(`Successfully imported ${questions.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        quizId: quiz.id,
        questionsCount: questions.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in import-quiz-from-sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function getAccessToken(credentials: any): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: credentials.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const privateKey = await importPrivateKey(credentials.private_key);
  const signature = await sign(signatureInput, privateKey);
  const encodedSignature = base64UrlEncode(signature);

  const jwt = `${signatureInput}.${encodedSignature}`;

  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  let base64: string;
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(input)));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem.substring(
    pemHeader.length,
    pem.length - pemFooter.length
  ).replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    true,
    ['sign']
  );
}

async function sign(data: string, key: CryptoKey): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(data)
  );
}
