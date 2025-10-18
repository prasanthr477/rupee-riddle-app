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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { spreadsheetUrl, quizDate, title, description, entryFee, prizeAmount } = await req.json();

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

    // Prepare questions
    const questions: Question[] = rows.map((row: string[], index: number) => ({
      quiz_id: quiz.id,
      question_order: index + 1,
      question_text: row[0] || '',
      option_a: row[1] || '',
      option_b: row[2] || '',
      option_c: row[3] || '',
      option_d: row[4] || '',
      correct_option: row[5] || '',
      category: row[6] || 'General',
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
