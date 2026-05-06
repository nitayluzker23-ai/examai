import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "./App";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";
const fnHeaders = { apikey: SUPABASE_ANON_KEY };

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

const DIFF_LABEL = { Easy: "קל", Medium: "בינוני", Hard: "קשה" };
const DIFF_STYLE = {
  Easy:   { background: "#E1F5EE", color: "#0F6E56" },
  Medium: { background: "#EEEDFE", color: "#534AB7" },
  Hard:   { background: "#FAEEDA", color: "#854F0B" },
};

// ── Calculate which topics have the most errors ──────────
function calcWeakTopics(questions, submissions) {
  const stats = {}; // source_topic_id -> { topicId, name, total, wrong, questions[] }

  for (const sub of submissions) {
    for (const answer of (sub.answers ?? [])) {
      const q = questions.find(q => q.id === answer.question_id);
      if (!q) continue;
      const tid = q.source_topic_id ?? "unknown";
      const name = q.content?.topic_name ?? q.content?.sub_topic_name ?? tid;
      if (!stats[tid]) stats[tid] = { topicId: tid, name, total: 0, wrong: 0, questions: [] };
      stats[tid].total++;
      if (answer.selected_index !== q.content?.correct_answer_index) stats[tid].wrong++;
    }
  }

  // attach question list per topic (deduped)
  for (const q of questions) {
    const tid = q.source_topic_id ?? "unknown";
    if (stats[tid] && !stats[tid].questions.find(x => x.id === q.id)) {
      stats[tid].questions.push(q);
    }
  }

  return Object.values(stats)
    .filter(s => s.total > 0)
    .map(s => ({ ...s, errorRate: s.wrong / s.total }))
    .sort((a, b) => b.errorRate - a.errorRate);
}

// ── Build prompt for topic-focused generation ────────────
function buildTopicPrompt(topic, count) {
  const existing = topic.questions
    .map((q, i) => `${i + 1}. ${q.content?.question_text ?? ""}`)
    .join("\n");
  return (
    `צור ${count} שאלות רב-ברירה חדשות על הנושא: "${topic.name}".\n\n` +
    `שיעור שגיאות התלמידים בנושא זה: ${Math.round(topic.errorRate * 100)}%.\n` +
    `כוון את השאלות לחיזוק ההבנה — שאלות שמבהירות את הנקודות שבהן תלמידים נוטים לטעות.\n\n` +
    `שאלות קיימות בנושא זה (אל תחזור עליהן):\n${existing}`
  );
}

export default function ExamQuestionsPage() {
  const { examId } = useParams();
  const [exam,        setExam]        = useState(null);
  const [questions,   setQuestions]   = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [weakTopics,  setWeakTopics]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [expanded,    setExpanded]    = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  // generate-more state
  const [generating,  setGenerating]  = useState(null); // topicId being generated
  const [genCount,    setGenCount]    = useState(5);
  const [genError,    setGenError]    = useState("");
  const [newlyAdded,  setNewlyAdded]  = useState(new Set()); // highlight newly added q ids

  useEffect(() => { load(); }, [examId]);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [
        { data: examData,  error: eErr },
        { data: qData,     error: qErr },
        { data: subData,   error: sErr },
      ] = await Promise.all([
        supabase.from("exams").select("id,title,status,access_code,config").eq("id", examId).single(),
        supabase.from("questions").select("*").eq("exam_id", examId).order("sort_order"),
        supabase.from("submissions").select("answers").eq("exam_id", examId),
      ]);
      if (eErr) throw eErr;
      if (qErr) throw qErr;
      const qs = qData ?? [];
      const subs = sErr ? [] : (subData ?? []);
      setExam(examData);
      setQuestions(qs);
      setSubmissions(subs);
      setWeakTopics(subs.length > 0 ? calcWeakTopics(qs, subs) : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async (id) => {
    if (!confirm("למחוק שאלה זו?")) return;
    setDeleting(id);
    const { error: e } = await supabase.from("questions").delete().eq("id", id);
    if (e) { alert(e.message); setDeleting(null); return; }
    setQuestions(qs => qs.filter(q => q.id !== id));
    setDeleting(null);
  };

  const generateMore = async (topic) => {
    setGenerating(topic.topicId);
    setGenError("");
    try {
      const prompt = buildTopicPrompt(topic, genCount);
      const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
        body: { text: prompt, topic_reinforcement: true },
        headers: fnHeaders,
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      // Collect all questions from the AI response
      const newQs = [];
      (data?.content_structure ?? []).forEach(t => {
        t.sub_topics?.forEach(sub => {
          sub.questions?.forEach(q => {
            newQs.push({
              question_text: q.question_text,
              options: q.options,
              correct_answer_index: q.correct_answer_index,
              ai_explanation: q.ai_explanation,
              topic_name: topic.name,
            });
          });
        });
      });

      if (newQs.length === 0) throw new Error("ה-AI לא החזיר שאלות — נסה שוב");

      const sortBase = questions.length;
      const rows = newQs.map((q, i) => ({
        exam_id: examId,
        source_topic_id: topic.topicId,
        difficulty: "Medium",
        sort_order: sortBase + i,
        content: {
          question_text: q.question_text,
          options: q.options,
          correct_answer_index: q.correct_answer_index,
          ai_explanation: q.ai_explanation,
          topic_name: q.topic_name,
          auto_generated_reinforcement: true,
        },
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("questions").insert(rows).select();
      if (insErr) throw insErr;

      const insertedIds = new Set((inserted ?? []).map(q => q.id));
      setQuestions(prev => [...prev, ...(inserted ?? [])]);
      setNewlyAdded(prev => new Set([...prev, ...insertedIds]));
      // refresh weak topics with same submissions
      setWeakTopics(calcWeakTopics([...questions, ...(inserted ?? [])], submissions));
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const hasSubmissions = submissions.length > 0;

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/dashboard/exams" style={{ fontSize: 13, color: C.purple, textDecoration: "none" }}>← חזרה לרשימת המבחנים</Link>
      </div>

      {exam && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{exam.title}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{questions.length} שאלות</span>
            <span>{submissions.length} הגשות</span>
            {exam.access_code && <span>קוד: <code style={{ background: C.purpleLight, padding: "1px 6px", borderRadius: 4 }}>{exam.access_code}</code></span>}
            <span style={{ color: exam.status === "published" ? C.teal : C.amber }}>
              {exam.status === "published" ? "✓ פורסם" : "⏸ טיוטה"}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {/* ── WEAK TOPICS PANEL ── */}
      {hasSubmissions && weakTopics.length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.amber}`, borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ background: C.amberLight, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>📊 נושאים חלשים</div>
              <div style={{ fontSize: 12, color: "#6b5a2e", marginTop: 2 }}>
                מבוסס על {submissions.length} הגשות — לחץ "צור עוד שאלות" לחיזוק הנושא
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>כמות שאלות לייצור:</span>
              <select value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: "inherit", background: C.white }}>
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {genError && (
            <div style={{ padding: "8px 16px", background: C.redLight, color: C.red, fontSize: 12 }}>{genError}</div>
          )}

          <div style={{ padding: "8px 0" }}>
            {weakTopics.slice(0, 5).map(topic => {
              const pct = Math.round(topic.errorRate * 100);
              const isGenerating = generating === topic.topicId;
              return (
                <div key={topic.topicId}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                  {/* Error rate bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {topic.name}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 60 ? C.red : pct >= 40 ? C.amber : C.teal, flexShrink: 0, marginRight: 8 }}>
                        {pct}% שגיאות
                      </span>
                    </div>
                    <div style={{ height: 5, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${pct}%`,
                        background: pct >= 60 ? C.red : pct >= 40 ? "#F59E0B" : C.teal,
                        transition: "width 0.4s"
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                      {topic.wrong} מתוך {topic.total} תשובות שגויות · {topic.questions.length} שאלות קיימות
                    </div>
                  </div>
                  {/* Generate button */}
                  <button onClick={() => generateMore(topic)} disabled={!!generating}
                    style={{
                      padding: "7px 14px", borderRadius: 9, border: "none", cursor: generating ? "not-allowed" : "pointer",
                      background: isGenerating ? C.purpleLight : C.purple,
                      color: isGenerating ? C.purple : "white",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit", flexShrink: 0,
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                    {isGenerating ? (
                      <>
                        <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.purpleMid}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        מייצר...
                      </>
                    ) : "✦ צור עוד שאלות"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No submissions yet */}
      {!hasSubmissions && questions.length > 0 && (
        <div style={{ background: C.purpleLight, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.purple }}>
          עדיין אין הגשות למבחן זה. לאחר שתלמידים יגישו, כאן יוצגו הנושאים החלשים שלהם.
        </div>
      )}

      {!loading && questions.length === 0 && !error && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, color: C.muted }}>אין שאלות במבחן זה עדיין</div>
        </div>
      )}

      {/* ── QUESTIONS LIST ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {questions.map((q, idx) => {
          const c = q.content ?? {};
          const isOpen = expanded === q.id;
          const diff = q.difficulty ?? "Medium";
          const isNew = newlyAdded.has(q.id);
          return (
            <div key={q.id}
              style={{
                background: C.white,
                border: `1px solid ${isNew ? C.purple : isOpen ? C.purple : C.border}`,
                borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s",
                boxShadow: isNew ? `0 0 0 2px ${C.purpleLight}` : "none",
              }}>
              {isNew && (
                <div style={{ background: C.purpleLight, padding: "3px 12px", fontSize: 11, color: C.purple, fontWeight: 600 }}>
                  ✦ נוסף עכשיו — שאלת חיזוק
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}
                onClick={() => setExpanded(isOpen ? null : q.id)}>
                <span style={{ fontSize: 12, color: C.muted, minWidth: 24, flexShrink: 0 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 1.5 }}>{c.question_text}</span>
                {c.topic_name && (
                  <span style={{ fontSize: 10, color: C.muted, background: C.bg, padding: "2px 7px", borderRadius: 20, flexShrink: 0, border: `1px solid ${C.border}` }}>
                    {c.topic_name}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0, ...DIFF_STYLE[diff] }}>
                  {DIFF_LABEL[diff] ?? diff}
                </span>
                <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px 14px" }}>
                  {c.options?.map((opt, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", borderRadius: 8, marginBottom: 4,
                      background: i === c.correct_answer_index ? C.tealLight : C.bg,
                      border: `1px solid ${i === c.correct_answer_index ? "#9FD9C7" : "transparent"}`
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i === c.correct_answer_index ? C.teal : C.muted, flexShrink: 0, minWidth: 18 }}>
                        {i === c.correct_answer_index ? "✓" : `${i + 1}.`}
                      </span>
                      <span style={{ fontSize: 13, color: C.text }}>{opt}</span>
                    </div>
                  ))}
                  {c.ai_explanation && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: C.purpleLight, borderRadius: 8, fontSize: 12, color: C.purple, lineHeight: 1.6 }}>
                      <strong>הסבר: </strong>{c.ai_explanation}
                    </div>
                  )}
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => deleteQuestion(q.id)} disabled={deleting === q.id}
                      style={{ padding: "6px 14px", background: C.redLight, color: C.red, border: `1px solid #F09595`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      {deleting === q.id ? "מוחק..." : "מחק שאלה"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
