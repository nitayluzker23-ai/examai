/**
 * ExamAI QA Check — runs after every major feature addition.
 * Tests: auth, exams CRUD, questions, submissions, edge functions, past-exams-analyzer.
 * Usage: node qa-check.mjs --service-key <service_role_key>
 */

import { createClient } from "@supabase/supabase-js";

const URL  = "https://npksscocijjmgzgrolnq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";

const args = process.argv.slice(2);
const svcKeyIdx = args.indexOf("--service-key");
const SERVICE_KEY = svcKeyIdx !== -1 ? args[svcKeyIdx + 1] : null;

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = SERVICE_KEY
  ? createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

let passed = 0, failed = 0;

function ok(label)  { console.log(`  ✅ ${label}`); passed++; }
function fail(label, reason) { console.log(`  ❌ ${label}: ${reason}`); failed++; }

async function check(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e.message);
  }
}

// ── helpers ──────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

async function getUserToken() {
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.listUsers();
  if (error || !data?.users?.length) return null;
  const user = data.users.find(u => u.email?.includes("nitayluzker23"));
  if (!user) return null;
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  // Use service key to create session for testing edge functions
  return null; // edge function tests need real user token
}

// ══════════════════════════════════════════════════════════════
async function main() {
  console.log("\n🔍 ExamAI QA Check\n" + "=".repeat(50));

  // ── 1. DB Connectivity ──────────────────────────────────────
  console.log("\n📦 1. Database connectivity");
  await check("profiles table readable (anon)", async () => {
    const { error } = await anon.from("profiles").select("id").limit(1);
    if (error) throw new Error(error.message);
  });
  await check("exams table readable (anon)", async () => {
    const { error } = await anon.from("exams").select("id").limit(1);
    if (error) throw new Error(error.message);
  });
  await check("questions table readable (anon)", async () => {
    const { error } = await anon.from("questions").select("id").limit(1);
    if (error) throw new Error(error.message);
  });
  await check("students table readable (anon)", async () => {
    const { error } = await anon.from("students").select("id").limit(1);
    if (error) throw new Error(error.message);
  });
  await check("classes table readable (anon)", async () => {
    const { error } = await anon.from("classes").select("id").limit(1);
    if (error) throw new Error(error.message);
  });
  await check("feature_requests table exists (anon)", async () => {
    const { error } = await anon.from("feature_requests").select("id").limit(1);
    // RLS will block anon, but table should exist (not a "relation does not exist" error)
    if (error && error.message.includes("does not exist")) throw new Error(error.message);
  });

  // ── 2. DB Schema ────────────────────────────────────────────
  console.log("\n🗄️  2. Schema columns");
  if (admin) {
    await check("exams.is_self_test column exists", async () => {
      const { data, error } = await admin.from("exams").select("is_self_test").limit(1);
      if (error) throw new Error(error.message);
    });
    await check("profiles.onboarding_done column exists", async () => {
      const { data, error } = await admin.from("profiles").select("onboarding_done").limit(1);
      if (error) throw new Error(error.message);
    });
    await check("profiles.school_type column exists", async () => {
      const { data, error } = await admin.from("profiles").select("school_type").limit(1);
      if (error) throw new Error(error.message);
    });
    await check("profiles.hide_demo column exists", async () => {
      const { data, error } = await admin.from("profiles").select("hide_demo").limit(1);
      if (error) throw new Error(error.message);
    });
    await check("students.phone column exists", async () => {
      const { data, error } = await admin.from("students").select("phone").limit(1);
      if (error) throw new Error(error.message);
    });
    await check("students.address column exists", async () => {
      const { data, error } = await admin.from("students").select("address").limit(1);
      if (error) throw new Error(error.message);
    });
    await check("classes.year column exists", async () => {
      const { data, error } = await admin.from("classes").select("year").limit(1);
      if (error) throw new Error(error.message);
    });
  } else {
    console.log("  ⚠️  Skipping schema checks (no service key)");
  }

  // ── 3. RLS — Student can insert submission ──────────────────
  console.log("\n🔒 3. RLS policies");
  let testExamId = null;
  if (admin) {
    // Find any published exam to test submission
    const { data: exams } = await admin.from("exams")
      .select("id").eq("status", "published").limit(1);
    testExamId = exams?.[0]?.id ?? null;
  }

  if (testExamId) {
    await check("Anon can insert submission (no .select)", async () => {
      const tok = "qa-" + Date.now();
      const { error } = await anon.from("submissions").insert({
        exam_id: testExamId,
        student_name: "QA Test",
        student_token: tok,
        score: 75,
        answers: [],
        completed_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      // Cleanup
      if (admin) await admin.from("submissions").delete().eq("student_token", tok);
    });
  } else {
    console.log("  ⚠️  No published exam found for submission test");
  }

  await check("classes.workspace_id FK constraint removed", async () => {
    if (!admin) return; // skip if no admin
    const { error } = await admin.from("classes").insert({
      workspace_id: "00000000-0000-0000-0000-000000000001", // fake UUID, no FK should fail
      name: "QA Test Class",
    });
    if (error && error.message.includes("foreign key")) throw new Error("FK constraint still present!");
    // Cleanup
    if (!error) await admin.from("classes").delete().eq("name", "QA Test Class");
  });

  // ── 4. Exam creation flow ───────────────────────────────────
  console.log("\n📋 4. Exam creation (requires service key)");
  let qaExamId = null;
  if (admin) {
    const { data: users } = await admin.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email?.includes("nitayluzker"));
    const adminUserId = adminUser?.id;

    if (adminUserId) {
      await check("Can create exam", async () => {
        const code = generateCode();
        const { data, error } = await admin.from("exams").insert({
          workspace_id: adminUserId,
          title: "QA Test Exam",
          subject: "QA",
          config: { mode: "flexible", total_minutes: 30, can_go_back: true },
          status: "published",
          access_code: code,
          is_self_test: false,
        }).select().single();
        if (error) throw new Error(error.message);
        qaExamId = data.id;
      });

      if (qaExamId) {
        await check("Can add questions to exam", async () => {
          const { error } = await admin.from("questions").insert([
            { exam_id: qaExamId, sort_order: 0, difficulty: "Medium",
              content: { question_text: "QA Q1?", options: ["א","ב","ג","ד"], correct_answer_index: 0 } },
            { exam_id: qaExamId, sort_order: 1, difficulty: "Easy",
              content: { question_text: "QA Q2?", options: ["א","ב","ג","ד"], correct_answer_index: 1 } },
          ]);
          if (error) throw new Error(error.message);
        });

        await check("Can create self-test exam (is_self_test=true)", async () => {
          const code = generateCode();
          const { data, error } = await admin.from("exams").insert({
            workspace_id: adminUserId,
            title: "QA Self Test",
            subject: "QA",
            config: { mode: "flexible", total_minutes: 20, can_go_back: true },
            status: "published",
            access_code: code,
            is_self_test: true,
          }).select().single();
          if (error) throw new Error(error.message);
          // Cleanup self-test exam
          await admin.from("exams").delete().eq("id", data.id);
        });

        // Cleanup main test exam
        await admin.from("questions").delete().eq("exam_id", qaExamId);
        await admin.from("exams").delete().eq("id", qaExamId);
      }
    } else {
      console.log("  ⚠️  Admin user not found");
    }
  } else {
    console.log("  ⚠️  Skipping (no service key)");
  }

  // ── 5. Edge Functions ───────────────────────────────────────
  console.log("\n⚡ 5. Edge functions (CORS + reachability)");
  await check("smart-handler OPTIONS returns 200", async () => {
    const res = await fetch(`${URL}/functions/v1/smart-handler`, { method: "OPTIONS" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
  });
  await check("ai-assistant OPTIONS returns 200", async () => {
    const res = await fetch(`${URL}/functions/v1/ai-assistant`, { method: "OPTIONS" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const allow = res.headers.get("access-control-allow-methods") ?? "";
    if (!allow.includes("POST")) throw new Error(`Missing POST in Allow-Methods: "${allow}"`);
  });
  await check("past-exams-analyzer OPTIONS returns 200", async () => {
    const res = await fetch(`${URL}/functions/v1/past-exams-analyzer`, { method: "OPTIONS" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
  });
  await check("ai-assistant returns 401 without token", async () => {
    const res = await fetch(`${URL}/functions/v1/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // ── 6. Student flow ─────────────────────────────────────────
  console.log("\n🎓 6. Student exam access");
  await check("Can fetch published exam by access code (anon)", async () => {
    if (!admin) return;
    // create temp exam
    const { data: users } = await admin.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email?.includes("nitayluzker"));
    if (!adminUser) return;
    const code = generateCode();
    const { data: exam, error: eErr } = await admin.from("exams").insert({
      workspace_id: adminUser.id, title: "QA Access Test", subject: "QA",
      config: { mode: "flexible", total_minutes: 10 }, status: "published", access_code: code,
    }).select().single();
    if (eErr) throw new Error(eErr.message);

    // Try fetching as anon
    const { data, error } = await anon.from("exams")
      .select("id,title,status")
      .eq("access_code", code).eq("status", "published").single();
    if (error || !data) throw new Error(error?.message ?? "Exam not found");

    // Cleanup
    await admin.from("exams").delete().eq("id", exam.id);
  });

  // ── Summary ─────────────────────────────────────────────────
  const total = passed + failed;
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`❌ ${failed} test(s) FAILED — fix before shipping!`);
    process.exit(1);
  } else {
    console.log("🎉 All tests passed!");
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
