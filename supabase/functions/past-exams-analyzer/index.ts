import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const { exams, num_questions = 15, subject = '' } = await req.json();
    if (!exams?.length) return new Response(JSON.stringify({ error: 'No exams provided' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const totalExams = exams.length;
    const examTexts = exams.map((e: any, i: number) =>
      '=== מבחן ' + (e.label || (i + 1)) + ' ===\n' + (e.text || '').slice(0, 2500)
    ).join('\n\n');

    // SINGLE combined call: analysis + question generation in one response (faster, no timeout)
    const prompt = [
      'אתה מנתח מבחנים אקדמי. קיבלת ' + totalExams + ' מבחנים' + (subject ? ' ב' + subject : '') + '.',
      '',
      'המבחנים:',
      examTexts,
      '',
      'בצע שתי משימות בתשובה אחת: (1) ניתוח המבחנים (2) יצירת ' + num_questions + ' שאלות חדשות בסגנון המבחנים.',
      '',
      'החזר JSON בלבד (ללא טקסט לפני/אחרי) במבנה:',
      '{',
      '  "analysis": {',
      '    "recurring_topics": [{"name":"נושא","count":2,"total":' + totalExams + ',"description":"תיאור קצר"}],',
      '    "structure": {"avg_questions":20,"difficulty_split":{"easy":30,"medium":50,"hard":20},"common_formats":["רב ברירה"]},',
      '    "predictions": [{"topic":"נושא","reason":"סיבה","confidence":"גבוה"}],',
      '    "style_notes": "הערות על הסגנון"',
      '  },',
      '  "questions": {',
      '    "content_structure": [{"topic":"נושא","sub_topics":[{"name":"תתנושא","questions":[{"question_text":"שאלה","options":["א","ב","ג","ד"],"correct_answer_index":0,"ai_explanation":"הסבר"}]}]}]',
      '  }',
      '}',
      '',
      'הנחיות: נושאים חוזרים = מופיעים ב-2 מבחנים לפחות. כל שאלה עם 4 אפשרויות ותשובה נכונה אחת.',
    ].join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('Anthropic error:', res.status, t);
      return new Response(JSON.stringify({ error: 'שגיאה ביצירת השאלות. נסה שוב.' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const claude = await res.json();
    const raw = (claude.content?.[0]?.text ?? '').trim();

    let parsed;
    try {
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      parsed = JSON.parse(raw.slice(s, e + 1));
    } catch {
      parsed = { analysis: { recurring_topics: [], structure: {}, predictions: [], style_notes: '' }, questions: { content_structure: [] } };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('past-exams-analyzer error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
