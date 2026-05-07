import { createClient } from "@supabase/supabase-js";
const URL  = "https://npksscocijjmgzgrolnq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const examId = "96319c95-0e7f-441d-bb16-319527d2250d";

const { data: qs, error: qErr } = await anon.from("questions").select("id,content").eq("exam_id", examId).limit(3);
console.log("questions fetched:", qs?.length, qErr?.message);

// Test 1: insert without .select() (should work with anon)
const tok = "tok-" + Date.now();
const { error: e1 } = await anon.from("submissions").insert({
  exam_id: examId,
  student_name: "debug test (no select)",
  student_token: tok,
  score: 80,
  answers: (qs ?? []).map(q => ({ question_id: q.id, selected_index: 0, time_spent_seconds: 5 })),
  completed_at: new Date().toISOString(),
});
console.log("insert (no select):", e1 ? `❌ ${e1.message}` : "✅ ok");

// Test 2: insert WITH .select() (tests if student can read back own row)
const tok2 = "tok2-" + Date.now();
const { data: d2, error: e2 } = await anon.from("submissions").insert({
  exam_id: examId,
  student_name: "debug test (with select)",
  student_token: tok2,
  score: 90,
  answers: [],
  completed_at: new Date().toISOString(),
}).select("id,score").single();
console.log("insert (with select):", e2 ? `❌ ${e2.message}` : `✅ id=${d2?.id?.slice(0,8)}, score=${d2?.score}`);
