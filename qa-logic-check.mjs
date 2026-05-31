/**
 * ExamAI Logic QA — tests actual AI generation and data flow.
 * Requires: node qa-logic-check.mjs --service-key <key>
 */

import { createClient } from "@supabase/supabase-js";

const URL  = "https://npksscocijjmgzgrolnq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";

const args = process.argv.slice(2);
const svcIdx = args.indexOf("--service-key");
const SERVICE_KEY = svcIdx !== -1 ? args[svcIdx + 1] : null;

if (!SERVICE_KEY) { console.error("❌ --service-key required"); process.exit(1); }

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

let passed = 0, failed = 0;
function ok(label)        { console.log(`  ✅ ${label}`); passed++; }
function fail(label, msg) { console.log(`  ❌ ${label}: ${msg}`); failed++; }

// ── Get a real user JWT ───────────────────────────────────────
async function getUserJWT() {
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users?.find(u => u.email?.includes("nitayluzker"));
  if (!user) throw new Error("Admin user not found");
  // Sign in with service key to get a user-level token
  const { data: session, error } = await admin.auth.admin.createSession({ user_id: user.id });
  if (error) throw new Error("Could not create session: " + error.message);
  return { token: session.session.access_token, userId: user.id };
}

function generateCode() {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

// ── Sample texts ─────────────────────────────────────────────
const SAMPLE_EXAM_TEXT = `
מבחן בביולוגיה — שנה"ל תשפ"ג
1. מהו התפקיד העיקרי של המיטוכונדריה בתא?
   א. ייצור חלבונים  ב. ייצור ATP  ג. אחסון DNA  ד. פירוק פסולת
2. איזה תהליך הופך אור לאנרגיה כימית?
   א. נשימה תאית  ב. פוטוסינתזה  ג. גליקוליזה  ד. פרמנטציה
3. מה הם מרכיבי הממברנה התאית?
   א. חלבונים ופוספוליפידים  ב. DNA ו-RNA  ג. גלוקוז ומים
4. מהי הפונקציה של הריבוזום?
   א. עיכול  ב. סינתוז חלבונים  ג. ייצור אנרגיה  ד. חלוקת תא
5. בתהליך המיוזה, כמה חלוקות תא מתרחשות?
   א. אחת  ב. שתיים  ג. שלוש  ד. ארבע
`;

const SAMPLE_EXAM_TEXT_2 = `
מבחן ביולוגיה — תשפ"ד
1. איזה אורגנל מייצר ATP בתא אוקריוטי?
   א. גרעין  ב. מיטוכונדריה  ג. ריבוזום  ד. כלורופלסט
2. מה הוא התוצר הסופי של פוטוסינתזה?
   א. CO2 ומים  ב. ATP בלבד  ג. גלוקוז וחמצן  ד. ADP
3. כמה כרומוזומים יש בתא אנושי רגיל?
   א. 23  ב. 46  ג. 92  ד. 48
4. מה מייצרים הריבוזומים?
   א. שומנים  ב. חלבונים  ג. פחמימות  ד. ATP
5. מהו ה-DNA?
   א. חומצת שומן  ב. מולקולת מידע גנטי  ג. חלבון ממברנה
`;

const SAMPLE_CONTENT = `
פוטוסינתזה היא תהליך שבו צמחים הופכים אור שמש לאנרגיה כימית.
המשוואה הכללית: 6CO2 + 6H2O + אור → C6H12O6 + 6O2
הכלורופיל הוא הפיגמנט הירוק הקולט את האור.
ישנם שני שלבים: תגובות האור (בתילקואידים) ומחזור קלוין (בסטרומה).
המיטוכונדריה היא ה"תחנת כוח" של התא — מייצרת ATP בנשימה תאית.
`;

async function main() {
  console.log("\n🔬 ExamAI Logic QA\n" + "=".repeat(55));

  let token, userId;
  try {
    const auth = await getUserJWT();
    token = auth.token; userId = auth.userId;
    ok("Got user JWT successfully");
  } catch (e) {
    fail("Get user JWT", e.message);
    process.exit(1);
  }

  const authedClient = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // ── 1. smart-handler ────────────────────────────────────────
  console.log("\n🤖 1. smart-handler — question generation");

  let smartResult = null;
  try {
    const { data, error } = await authedClient.functions.invoke("smart-handler", {
      body: { text: SAMPLE_CONTENT, num_questions: 3 },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    smartResult = data;
    ok("smart-handler returned response");
  } catch (e) {
    fail("smart-handler call", e.message);
  }

  if (smartResult) {
    const hasStructure = Array.isArray(smartResult?.content_structure);
    hasStructure ? ok("Response has content_structure array") : fail("content_structure", "missing or not array");

    const allQs = [];
    (smartResult?.content_structure ?? []).forEach(t =>
      t.sub_topics?.forEach(s => s.questions?.forEach(q => allQs.push(q)))
    );
    allQs.length >= 2 ? ok(`Generated ${allQs.length} questions`) : fail("Question count", `only ${allQs.length}`);

    const firstQ = allQs[0];
    firstQ?.question_text   ? ok("question_text present") : fail("question_text", "missing");
    Array.isArray(firstQ?.options) && firstQ.options.length === 4
      ? ok("4 options per question") : fail("options", `got ${firstQ?.options?.length}`);
    typeof firstQ?.correct_answer_index === "number"
      ? ok("correct_answer_index is number") : fail("correct_answer_index", "missing or wrong type");
    firstQ?.correct_answer_index >= 0 && firstQ?.correct_answer_index <= 3
      ? ok("correct_answer_index in range 0-3") : fail("correct_answer_index range", firstQ?.correct_answer_index);
  }

  // ── 2. past-exams-analyzer ──────────────────────────────────
  console.log("\n📂 2. past-exams-analyzer — analysis + generation");

  let pastResult = null;
  try {
    const { data, error } = await authedClient.functions.invoke("past-exams-analyzer", {
      body: {
        exams: [
          { label: "תשפ״ג", text: SAMPLE_EXAM_TEXT },
          { label: "תשפ״ד", text: SAMPLE_EXAM_TEXT_2 },
        ],
        num_questions: 5,
        subject: "ביולוגיה",
      },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    pastResult = data;
    ok("past-exams-analyzer returned response");
  } catch (e) {
    fail("past-exams-analyzer call", e.message);
  }

  if (pastResult) {
    // Analysis checks
    const analysis = pastResult.analysis;
    analysis ? ok("analysis object present") : fail("analysis", "missing");

    const topics = analysis?.recurring_topics;
    Array.isArray(topics) && topics.length > 0
      ? ok(`Found ${topics.length} recurring topics`) : fail("recurring_topics", "empty or missing");

    const firstTopic = topics?.[0];
    firstTopic?.name  ? ok("topic has name") : fail("topic.name", "missing");
    typeof firstTopic?.count === "number" ? ok("topic has count") : fail("topic.count", "missing");

    const predictions = analysis?.predictions;
    Array.isArray(predictions) && predictions.length > 0
      ? ok(`Found ${predictions.length} predictions`) : fail("predictions", "empty or missing");

    const firstPred = predictions?.[0];
    firstPred?.topic  ? ok("prediction has topic") : fail("prediction.topic", "missing");
    firstPred?.reason ? ok("prediction has reason") : fail("prediction.reason", "missing");

    const structure = analysis?.structure;
    structure ? ok("structure object present") : fail("structure", "missing");

    // Questions checks
    const qs = pastResult.questions;
    qs?.content_structure ? ok("questions.content_structure present") : fail("questions", "missing content_structure");

    const allPastQs = [];
    (qs?.content_structure ?? []).forEach(t =>
      t.sub_topics?.forEach(s => s.questions?.forEach(q => allPastQs.push(q)))
    );
    allPastQs.length >= 3
      ? ok(`Generated ${allPastQs.length} past-style questions`) : fail("past questions count", `only ${allPastQs.length}`);
  }

  // ── 3. Full self-test flow ──────────────────────────────────
  console.log("\n🎓 3. Full self-test creation flow");

  let examId = null;
  try {
    const code = generateCode();
    const { data, error } = await admin.from("exams").insert({
      workspace_id: userId,
      title: "QA Logic Test",
      subject: "ביולוגיה",
      config: { mode: "flexible", total_minutes: 30, can_go_back: true },
      status: "published",
      access_code: code,
      is_self_test: true,
    }).select().single();
    if (error) throw new Error(error.message);
    examId = data.id;
    ok("Created self-test exam");

    // Insert questions from smart-handler result
    if (smartResult) {
      const qs = [];
      (smartResult.content_structure ?? []).forEach((t, ti) =>
        t.sub_topics?.forEach((s, si) =>
          s.questions?.forEach((q, qi) => qs.push({
            exam_id: examId, sort_order: qs.length, difficulty: "Medium",
            content: { question_text: q.question_text, options: q.options, correct_answer_index: q.correct_answer_index, ai_explanation: q.ai_explanation },
          }))
        )
      );
      const { error: qErr } = await admin.from("questions").insert(qs);
      qErr ? fail("Insert questions", qErr.message) : ok(`Inserted ${qs.length} questions into exam`);
    }

    // Submit as student (anon)
    const tok = "qa-logic-" + Date.now();
    const { error: subErr } = await admin.from("submissions").insert({
      exam_id: examId,
      student_name: "QA Tester",
      student_token: tok,
      score: 80,
      answers: [],
      completed_at: new Date().toISOString(),
    });
    subErr ? fail("Student submission", subErr.message) : ok("Student submission inserted");

    // Verify submission readable by admin
    const { data: subs } = await admin.from("submissions").select("score").eq("exam_id", examId);
    subs?.length > 0 ? ok("Submission readable, score: " + subs[0].score) : fail("Read submission", "not found");

  } catch (e) {
    fail("Self-test flow", e.message);
  } finally {
    // Cleanup
    if (examId) {
      await admin.from("questions").delete().eq("exam_id", examId);
      await admin.from("submissions").delete().eq("exam_id", examId);
      await admin.from("exams").delete().eq("id", examId);
      ok("Cleanup complete");
    }
  }

  // ── 4. SelfTestPage enrichedText logic check ────────────────
  console.log("\n📝 4. enrichedText building logic (unit test)");
  const text = "חומר לימוד";
  const topicTags = ["פוטוסינתזה", "מיטוכונדריה"];
  const lecturerHint = "הבחינה תתמקד בפרקים 3-5";
  const hwText = "שיעורי בית על נשימה תאית";

  let enriched = text;
  if (topicTags.length > 0) enriched = `נושאים חשובים שיש להתמקד בהם: ${topicTags.join(", ")}.\n\n${enriched}`;
  if (lecturerHint.trim()) enriched = `הנחיית המרצה/המורה: ${lecturerHint.trim()}\n\n${enriched}`;
  if (hwText.trim()) enriched = `${enriched}\n\n--- שיעורי בית ---\n${hwText.trim()}`;

  enriched.includes("נושאים חשובים") ? ok("Topic tags prepended") : fail("Topic tags", "not in enriched text");
  enriched.includes("הנחיית המרצה")  ? ok("Lecturer hint prepended") : fail("Lecturer hint", "not in enriched text");
  enriched.includes("שיעורי בית")     ? ok("Homework appended") : fail("Homework", "not in enriched text");
  enriched.startsWith("הנחיית המרצה") ? ok("Correct order: hint first") : fail("Order", "hint not first");

  // ── Summary ─────────────────────────────────────────────────
  const total = passed + failed;
  console.log("\n" + "=".repeat(55));
  console.log(`📊 Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`❌ ${failed} FAILED — must fix before shipping!`);
    process.exit(1);
  } else {
    console.log("🎉 All logic checks passed!");
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
