import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const SYSTEM_PROMPT = `אתה מומחה ללמידה דיגיטלית (Instructional Designer). תפקידך לנתח תוכן לימודי ולהפוך אותו למבנה נתונים חכם בפורמט JSON בלבד.

אם קיבלת תמונה — קרא אותה תחילה והפק ממנה את הטקסט המלא, כולל נוסחאות, טבלאות ושאלות.

דגשים לביצוע:
1. זיהוי היררכי: חלק את התוכן לנושאים (topics) ותתי-נושאים (sub_topics).
2. שטוח ונגיש: לכל שאלה הוסף מזהה נושא ומזהה תת-נושא.
3. מזהים: השתמש בפורמט st1_q1.
4. איכות פדגוגית: שאלות שבוחנות הבנה עמוקה. ההסבר חייב להיות מעודד ומלמד.

החזר אך ורק JSON תקני ללא טקסט חופשי לפני או אחרי:
{
  "course_metadata": {
    "title": "שם הקורס",
    "total_estimated_reading_minutes": 0,
    "language": "he"
  },
  "content_structure": [
    {
      "topic_id": "t1",
      "topic_name": "שם הנושא",
      "sub_topics": [
        {
          "sub_topic_id": "st1",
          "name": "שם תת-נושא",
          "summary": "סיכום ממוקד",
          "questions": [
            {
              "question_id": "st1_q1",
              "source_topic_id": "t1",
              "source_sub_topic_id": "st1",
              "difficulty": "Medium",
              "question_type": "multiple_choice",
              "question_text": "השאלה בעברית?",
              "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
              "correct_answer_index": 0,
              "ai_explanation": "הסבר מפורט למה א נכונה ומה הטעות באחרות."
            }
          ]
        }
      ]
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY לא מוגדר ב-Edge Function" }),
      { status: 500, headers }
    );
  }

  try {
    const { text, image, image_type, chunk_index, num_questions, question_types } = await req.json();

    // Build instruction for exact count + allowed types
    const count = Number.isInteger(num_questions) && num_questions > 0 ? num_questions : null;
    const countInstruction = count
      ? `\n\nחשוב מאוד: צור בדיוק ${count} שאלות סך הכל — לא יותר ולא פחות. חלק אותן בין הנושאים בצורה מאוזנת.`
      : "";

    // Allowed question types (default: multiple choice only)
    const types = Array.isArray(question_types) && question_types.length ? question_types : ["multiple_choice"];
    const typeInstruction = types.length > 1 || types[0] !== "multiple_choice"
      ? `\n\nסוגי שאלות מותרים: ${types.join(", ")}.
- multiple_choice: 4 אפשרויות, question_type="multiple_choice".
- true_false: בדיוק 2 אפשרויות ["נכון","לא נכון"], question_type="true_false".
- open: ללא אפשרויות, הוסף שדה "model_answer" עם תשובה לדוגמה, question_type="open", correct_answer_index=null.
ערבב בין הסוגים המותרים.`
      : "";

    let messageContent: any[];

    if (image) {
      messageContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: image_type ?? "image/jpeg",
            data: image,
          },
        },
        {
          type: "text",
          text: `קרא את התוכן בתמונה וצור מבנה JSON מלא עם נושאים ושאלות לפי ההנחיות.${countInstruction}${typeInstruction}`,
        },
      ];
    } else if (text) {
      const base = chunk_index !== undefined
        ? `זהו חלק ${chunk_index + 1} מתוך מסמך גדול. נתח אותו וצור JSON עם נושאים ושאלות:\n\n${text}`
        : `נתח את הטקסט הבא וצור מבנה JSON מלא עם נושאים ושאלות:\n\n${text}`;
      messageContent = [{ type: "text", text: base + countInstruction + typeInstruction }];
    } else {
      return new Response(
        JSON.stringify({ error: "חסר טקסט או תמונה" }),
        { status: 400, headers }
      );
    }

    // Sonnet for images (vision), Haiku for text (fast + cheap)
    const model = image ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      // Scale output budget to requested question count (faster); cap at 8192
      body: JSON.stringify({
        model,
        max_tokens: count ? Math.min(8192, Math.max(1500, count * 400)) : 8192,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: `שגיאה מ-Claude API (${response.status}): ${err}` }),
        { status: 500, headers }
      );
    }

    const data = await response.json();
    const content = data.content[0].text;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "לא ניתן לפרסר את תשובת ה-AI", raw: content.slice(0, 300) }),
        { status: 500, headers }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(parsed), { headers });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers }
    );
  }
});
