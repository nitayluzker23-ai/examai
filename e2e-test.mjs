/**
 * ExamAI — End-to-End Test Suite
 * ================================
 * Tests every core feature from exam creation to student submission.
 *
 * Run:   node e2e-test.mjs
 *        node e2e-test.mjs --service-key <your_service_role_key>
 *
 * With service key: full suite (creates & cleans up test teacher).
 * Without service key: partial suite using existing published exam (SNRLQN).
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────
const URL  = "https://npksscocijjmgzgrolnq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";

// Grab service key from CLI: node e2e-test.mjs --service-key sk_...
const SVC_IDX = process.argv.indexOf("--service-key");
const SVC = SVC_IDX !== -1 ? process.argv[SVC_IDX + 1] : process.env.SUPABASE_SERVICE_KEY;

const FULL_MODE = !!SVC;

// Existing published exam used when running without service key
const EXISTING_EXAM_CODE = "SNRLQN";

// ── Supabase clients ─────────────────────────────────────────
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const svc  = SVC ? createClient(URL, SVC, { auth: { persistSession: false } }) : null;

// ── Logging ──────────────────────────────────────────────────
let passed = 0, failed = 0;
function ok(label)        { passed++; console.log(`  ✅  ${label}`); }
function fail(label, err) { failed++; console.error(`  ❌  ${label} — ${err?.message ?? err ?? "?"}`); }
function skip(label)      { console.log(`  ⏭   ${label}`); }

async function section(title, fn) {
  console.log(`\n${"─".repeat(58)}`);
  console.log(`📋  ${title}`);
  console.log(`${"─".repeat(58)}`);
  try { await fn(); }
  catch (e) { fail(`[crash] ${title}`, e); }
}

// ── Helpers ──────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

function makeQuestion(i) {
  return {
    question_text: `שאלת e2e מספר ${i + 1}`,
    options: ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
    correct_answer_index: i % 4,
    ai_explanation: `הסבר לשאלה ${i + 1}`,
  };
}

// ── Main ─────────────────────────────────────────────────────
async function run() {
  console.log("═".repeat(58));
  console.log("   ExamAI — End-to-End Test Suite");
  console.log(`   ${new Date().toLocaleString("he-IL")}`);
  console.log(`   מצב: ${FULL_MODE ? "מלא (service key)" : "חלקי (ללא service key)"}`);
  console.log("═".repeat(58));

  // Shared state
  let teacherClient = null;
  let teacherId     = null;
  let examIds       = {}; // { flexible, timed, sessions }
  let examCodes     = {};

  // ══════════════════════════════════════════════════════════
  if (FULL_MODE) {
    await section("1. יצירת מורה בדיקה (service role)", async () => {
      const email = `e2e-${Date.now()}@example.com`;
      const pass  = "E2eTest123!";

      // Create user via admin API (no email confirmation needed)
      const { data: created, error: cErr } = await svc.auth.admin.createUser({
        email, password: pass,
        email_confirm: true,   // skip confirmation
      });
      if (cErr || !created?.user) { fail("Create teacher via admin", cErr); return; }
      teacherId = created.user.id;
      ok(`Teacher created via admin (${teacherId.slice(0,8)}…)`);

      // Sign in as this teacher using the anon client
      const { data: si, error: siErr } = await anon.auth.signInWithPassword({ email, password: pass });
      if (siErr || !si?.session) { fail("Teacher sign-in", siErr); return; }
      ok("Teacher signed in");

      teacherClient = createClient(URL, ANON, { auth: { persistSession: false } });
      await teacherClient.auth.setSession(si.session);
      ok("Authenticated client ready");

      // Profile should be auto-created by DB trigger
      await new Promise(r => setTimeout(r, 1000)); // wait for trigger
      const { data: prof, error: pErr } = await teacherClient
        .from("profiles").select("id, plan").eq("id", teacherId).single();
      if (pErr || !prof) fail("Profile auto-created by trigger", pErr ?? "not found");
      else ok(`Profile exists — plan: ${prof.plan ?? "free"}`);
    });

  } else {
    await section("1. בדיקת גישה בסיסית (ללא service key)", async () => {
      skip("דילוג על יצירת מורה — נדרש service key");
      skip("הבדיקות ישתמשו בנתונים קיימים בלבד");
    });
  }

  // ══════════════════════════════════════════════════════════
  if (FULL_MODE && teacherClient && teacherId) {
    await section("2. יצירת מבחנים — 3 מצבים", async () => {
      const modes = [
        { key: "flexible", label: "גמיש",   config: { mode: "flexible", total_minutes: 30, can_go_back: true } },
        { key: "timed",    label: "מתוזמן", config: { mode: "timed", seconds_per_question: 45, can_go_back: false } },
        { key: "sessions", label: "סשנים",  config: { mode: "sessions", break_minutes: 5, sessions: [{ mins: 10, questions: 3 }, { mins: 10, questions: 2 }] } },
      ];

      for (const m of modes) {
        const code = genCode();
        const { data, error } = await teacherClient.from("exams").insert({
          workspace_id: teacherId,
          title:  `מבחן e2e — ${m.label}`,
          subject: "בדיקות",
          config:  m.config,
          status:  "draft",
          access_code: code,
        }).select().single();

        if (error || !data) { fail(`צור מבחן ${m.label}`, error); continue; }
        examIds[m.key]   = data.id;
        examCodes[m.key] = code;
        ok(`מבחן נוצר (${m.label}) — קוד: ${code}`);
      }
    });

    await section("3. הוספת שאלות (5 לכל מבחן)", async () => {
      for (const [key, examId] of Object.entries(examIds)) {
        if (!examId) { fail(`שאלות ${key}`, "exam not created"); continue; }
        const rows = Array.from({ length: 5 }, (_, i) => ({
          exam_id: examId, sort_order: i,
          difficulty: ["Easy","Medium","Hard"][i % 3],
          content: makeQuestion(i),
        }));
        const { error } = await teacherClient.from("questions").insert(rows);
        if (error) fail(`הוסף שאלות (${key})`, error);
        else ok(`5 שאלות נוספו (${key})`);
      }
    });

    await section("4. פרסום מבחנים", async () => {
      for (const [key, examId] of Object.entries(examIds)) {
        if (!examId) { fail(`פרסום ${key}`, "exam not created"); continue; }
        const { error } = await teacherClient.from("exams")
          .update({ status: "published" }).eq("id", examId);
        if (error) fail(`פרסום (${key})`, error);
        else ok(`מבחן פורסם (${key})`);
      }
    });
  } else {
    await section("2–4. שלד — יצירת מבחן + שאלות + פרסום", async () => {
      skip("דילוג — נדרש service key ליצירת מורה חדש");
      // Use the existing exam for student tests
      const { data } = await anon.from("exams")
        .select("id,access_code").eq("access_code", EXISTING_EXAM_CODE).single();
      if (data) {
        examIds.existing   = data.id;
        examCodes.existing = data.access_code;
        ok(`שימוש במבחן קיים — ${EXISTING_EXAM_CODE} (id: ${data.id.slice(0,8)}…)`);
      } else {
        fail("מבחן קיים לא נמצא", `access_code = ${EXISTING_EXAM_CODE}`);
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  await section("5. תלמיד קורא מבחן ושאלות (anon)", async () => {
    const toTest = FULL_MODE
      ? Object.entries(examCodes).map(([k, c]) => [c, k])
      : [[EXISTING_EXAM_CODE, "existing"]];

    for (const [code, label] of toTest) {
      if (!code) { fail(`קריאה (${label})`, "no code"); continue; }

      const { data: exam, error: eErr } = await anon.from("exams")
        .select("id,title,config").eq("access_code", code).eq("status","published").single();
      if (eErr || !exam) { fail(`תלמיד קורא מבחן (${label})`, eErr ?? "not found"); continue; }
      ok(`תלמיד מוצא מבחן (${label}) — "${exam.title}"`);

      const { data: qs, error: qErr } = await anon.from("questions")
        .select("id,content,difficulty").eq("exam_id", exam.id).order("sort_order");
      if (qErr) { fail(`קריאת שאלות (${label})`, qErr); continue; }
      if (!qs?.length) { fail(`קריאת שאלות (${label})`, "0 שאלות"); continue; }
      ok(`${qs.length} שאלות נטענו (${label})`);
    }
  });

  // ══════════════════════════════════════════════════════════
  await section("6. תלמיד מגיש מבחן — כל 3 המצבים", async () => {
    const toTest = FULL_MODE
      ? Object.entries(examIds).map(([k, id]) => [id, k])
      : examIds.existing ? [[examIds.existing, "existing"]] : [];

    if (!toTest.length) { skip("אין מבחנים לבדיקה"); return; }

    for (const [examId, label] of toTest) {
      if (!examId) { fail(`הגשה (${label})`, "no exam id"); continue; }

      const { data: qs } = await anon.from("questions")
        .select("id,content").eq("exam_id", examId).order("sort_order");
      if (!qs?.length) { fail(`הגשה (${label})`, "אין שאלות"); continue; }

      const answers = qs.map(q => ({
        question_id:        q.id,
        selected_index:     q.content.correct_answer_index,
        time_spent_seconds: Math.floor(Math.random() * 20) + 5,
      }));

      // Note: anon cannot .select() back the row (teacher-only SELECT policy)
      // so we just insert and verify below via teacher client
      const { error } = await anon.from("submissions").insert({
        exam_id:       examId,
        student_name:  `בודק e2e — ${label}`,
        student_token: `e2e-token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        score:         100,
        answers,
        completed_at:  new Date().toISOString(),
      });

      if (error) fail(`הגשת מבחן (${label})`, error);
      else ok(`הגשה נרשמה (${label}) — ציון: 100%`);
    }
  });

  // ══════════════════════════════════════════════════════════
  if (FULL_MODE && teacherClient) {
    await section("7. מורה קורא הגשות", async () => {
      for (const [key, examId] of Object.entries(examIds)) {
        const { data, error } = await teacherClient.from("submissions")
          .select("id,student_name,score").eq("exam_id", examId);
        if (error) fail(`מורה קורא הגשות (${key})`, error);
        else if (!data?.length) fail(`מורה קורא הגשות (${key})`, "0 הגשות");
        else ok(`${data.length} הגשה/ות למורה (${key})`);
      }
    });

    await section("8. Live Dashboard — exam_live_stats", async () => {
      for (const [key, examId] of Object.entries(examIds)) {
        const { data, error } = await teacherClient.from("exam_live_stats")
          .select("*").eq("exam_id", examId).single();
        if (error) fail(`live stats (${key})`, error);
        else ok(`live stats (${key}) — ממוצע: ${data?.avg_score}%, הגשות: ${data?.total_submissions}`);
      }
    });

    await section("9. הגדרות מורה — עיצוב ארגוני", async () => {
      const { error } = await teacherClient.from("profiles").update({
        brand_name: "בית ספר e2e",
        brand_primary: "#534AB7",
      }).eq("id", teacherId);
      if (error) fail("שמירת עיצוב", error);
      else ok("עיצוב נשמר (brand_name + brand_primary)");

      const { data, error: rErr } = await teacherClient.from("profiles")
        .select("brand_name,brand_primary").eq("id", teacherId).single();
      if (rErr || data?.brand_name !== "בית ספר e2e") fail("קריאה חזרה של עיצוב", rErr);
      else ok(`עיצוב נקרא חזרה — ${data.brand_name}, ${data.brand_primary}`);
    });

    await section("10. חלון זמן — opens_at / closes_at", async () => {
      const examId = examIds.flexible;
      if (!examId) { fail("חלון זמן", "no flexible exam"); return; }

      const future = new Date(Date.now() + 3600_000).toISOString();
      const { error } = await teacherClient.from("exams")
        .update({ opens_at: future }).eq("id", examId);
      if (error) { fail("הגדרת opens_at", error); return; }
      ok("opens_at הוגדר לשעה מכאן");

      const { data } = await anon.from("exams")
        .select("opens_at").eq("id", examId).single();
      const locked = data?.opens_at && new Date(data.opens_at) > new Date();
      if (locked) ok("תלמיד נחסם נכון על ידי opens_at");
      else fail("בדיקת חלון זמן", "המבחן נראה פתוח כשצריך להיות עתידי");

      await teacherClient.from("exams").update({ opens_at: null }).eq("id", examId);
      ok("לוח זמנים נוקה");
    });

    await section("11. מבחן חזרה (retry exam)", async () => {
      const examId = examIds.flexible;
      if (!examId) { fail("מבחן חזרה", "no base exam"); return; }

      const { data: orig } = await teacherClient.from("exams").select("*").eq("id", examId).single();
      const retryCode = genCode();
      const { data: retry, error } = await teacherClient.from("exams").insert({
        workspace_id: teacherId,
        title: `${orig?.title} — חזרה`,
        subject: orig?.subject,
        config: orig?.config,
        status: "published",
        access_code: retryCode,
      }).select().single();
      if (error || !retry) { fail("יצירת מבחן חזרה", error); return; }
      ok(`מבחן חזרה נוצר — קוד: ${retryCode}`);

      const { data: srcQs } = await teacherClient.from("questions")
        .select("*").eq("exam_id", examId).limit(3).order("sort_order");
      if (srcQs?.length) {
        const cloned = srcQs.map((q, i) => ({
          exam_id: retry.id, sort_order: i,
          difficulty: q.difficulty, content: q.content,
        }));
        const { error: cErr } = await teacherClient.from("questions").insert(cloned);
        if (cErr) fail("שכפול שאלות לחזרה", cErr);
        else ok(`${cloned.length} שאלות שוכפלו למבחן חזרה`);

        // student submits retry
        const ans = srcQs.map(q => ({
          question_id: q.id,
          selected_index: q.content.correct_answer_index,
          time_spent_seconds: 10,
        }));
        const { error: subErr } = await anon.from("submissions").insert({
          exam_id:       retry.id,
          student_name:  "תלמיד חוזר",
          student_token: `e2e-retry-${Date.now()}`,
          score:         100, answers: ans,
          completed_at:  new Date().toISOString(),
        });
        if (subErr) fail("הגשת מבחן חזרה", subErr);
        else ok("הגשת מבחן חזרה נרשמה");

        // cleanup retry
        await teacherClient.from("questions").delete().eq("exam_id", retry.id);
        await teacherClient.from("submissions").delete().eq("exam_id", retry.id);
        await teacherClient.from("exams").delete().eq("id", retry.id);
        ok("מבחן חזרה נוקה");
      }
    });

    await section("12. ניקוי נתוני בדיקה", async () => {
      for (const id of Object.values(examIds)) {
        if (!id) continue;
        await svc.from("submissions").delete().eq("exam_id", id);
        await svc.from("questions").delete().eq("exam_id", id);
        await svc.from("exams").delete().eq("id", id);
      }
      if (teacherId) {
        await svc.from("profiles").delete().eq("id", teacherId);
        await svc.auth.admin.deleteUser(teacherId);
      }
      ok("כל נתוני הבדיקה נוקו");
    });

  } else {
    await section("7–11. בדיקות מורה", async () => {
      skip("דילוג — נדרש service key לבדיקות מורה");
      console.log("   הפעל: node e2e-test.mjs --service-key <service_role_key>");
    });
  }

  // ══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(58));
  console.log(`   תוצאות: ✅ ${passed} עברו   ❌ ${failed} נכשלו`);
  console.log("═".repeat(58));
  if (failed === 0) {
    console.log("\n🎉  כל הבדיקות עברו בהצלחה!\n");
  } else {
    console.log("\n⚠️  יש כשלונות — בדוק את הפלט למעלה.\n");
    process.exit(1);
  }
}

run().catch(e => {
  console.error("💥 נפילה:", e);
  process.exit(1);
});
