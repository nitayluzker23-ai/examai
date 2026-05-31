import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";
import { printExam, printAnswerKey, printClassReport } from "./printUtils";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";
const fnHeaders = { apikey: SUPABASE_ANON_KEY };

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

const DIFF_LABEL = { Easy: "קל", Medium: "בינוני", Hard: "קשה" };
const DIFF_STYLE = {
  Easy:   { background: "#E8EDE6", color: "#4F6F52" },
  Medium: { background: "#F4F2EC", color: "#37352F" },
  Hard:   { background: "#F3EBD9", color: "#9A7B3F" },
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
  // Truncate each question title to 80 chars — enough for dedup, not wasteful
  const existing = topic.questions
    .map((q, i) => `${i + 1}. ${(q.content?.question_text ?? "").slice(0, 80)}`)
    .join("\n");
  return (
    `צור ${count} שאלות רב-ברירה על: "${topic.name}" (${Math.round(topic.errorRate * 100)}% שגיאות).\n` +
    `התמקד בנקודות שתלמידים נוטים לטעות בהן.\n` +
    `קיימות כבר:\n${existing}`
  );
}

export default function ExamQuestionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exam,        setExam]        = useState(null);
  const [questions,   setQuestions]   = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [weakTopics,  setWeakTopics]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [expanded,    setExpanded]    = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [editing,     setEditing]     = useState(null);
  const [editDraft,   setEditDraft]   = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);
  // generate-more state
  const [generating,  setGenerating]  = useState(null); // topicId being generated
  const [genCount,    setGenCount]    = useState(5);
  const [genError,    setGenError]    = useState("");
  const [newlyAdded,  setNewlyAdded]  = useState(new Set()); // highlight newly added q ids
  const [uploading,   setUploading]   = useState(null);     // questionId being uploaded
  const [uploadError, setUploadError] = useState("");
  const [retryCount,  setRetryCount]  = useState(8);
  const [creatingRetry, setCreatingRetry] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

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
        supabase.from("submissions").select("id,student_name,score,answers,completed_at").eq("exam_id", examId).order("completed_at", { ascending: false }),
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

  const createRetryExam = async () => {
    if (!user || submissions.length === 0) return;
    setCreatingRetry(true);
    try {
      // Rank questions by error rate across all submissions
      const errorMap = {}; // question_id -> { wrong, total }
      for (const sub of submissions) {
        for (const a of (sub.answers ?? [])) {
          if (!errorMap[a.question_id]) errorMap[a.question_id] = { wrong: 0, total: 0 };
          errorMap[a.question_id].total++;
          const q = questions.find(q => q.id === a.question_id);
          if (q && a.selected_index !== q.content?.correct_answer_index) {
            errorMap[a.question_id].wrong++;
          }
        }
      }

      const ranked = questions
        .filter(q => errorMap[q.id]?.total > 0)
        .map(q => ({ ...q, errRate: errorMap[q.id].wrong / errorMap[q.id].total }))
        .sort((a, b) => b.errRate - a.errRate)
        .slice(0, retryCount);

      if (ranked.length === 0) {
        alert("אין מספיק נתוני שגיאות ליצירת מבחן חזרה.");
        setCreatingRetry(false);
        return;
      }

      // Create new exam
      const retryTitle = `חזרה — ${exam.title}`;
      const { data: newExam, error: eErr } = await supabase
        .from("exams")
        .insert({ workspace_id: user.id, title: retryTitle, subject: exam.subject, status: "draft", config: exam.config ?? {} })
        .select().single();
      if (eErr) throw eErr;

      // Copy ranked questions to new exam
      const newQs = ranked.map((q, i) => ({
        exam_id:         newExam.id,
        source_topic_id: q.source_topic_id,
        difficulty:      q.difficulty,
        sort_order:      i,
        content:         { ...q.content, auto_generated_reinforcement: true },
      }));
      const { error: qErr } = await supabase.from("questions").insert(newQs);
      if (qErr) throw qErr;

      navigate(`/dashboard/exams/${newExam.id}/questions`);
    } catch (e) {
      alert(`שגיאה ביצירת מבחן חזרה: ${e.message}`);
    } finally {
      setCreatingRetry(false);
    }
  };

  const uploadImage = async (question, file) => {
    setUploading(question.id);
    setUploadError("");
    try {
      const ext = file.name.split(".").pop();
      const path = `${examId}/${question.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("question-images")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from("question-images")
        .getPublicUrl(path);

      const newContent = { ...question.content, image_url: publicUrl };
      const { error: updateErr } = await supabase
        .from("questions").update({ content: newContent }).eq("id", question.id);
      if (updateErr) throw updateErr;

      setQuestions(qs => qs.map(q => q.id === question.id ? { ...q, content: newContent } : q));
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (question) => {
    if (!confirm("להסיר את התמונה מהשאלה?")) return;
    const newContent = { ...question.content };
    delete newContent.image_url;
    const { error } = await supabase
      .from("questions").update({ content: newContent }).eq("id", question.id);
    if (error) { alert(error.message); return; }
    setQuestions(qs => qs.map(q => q.id === question.id ? { ...q, content: newContent } : q));
  };

  const saveManualQuestion = async ({ questionText, options, correctIndex, difficulty, topicName }) => {
    const { data, error: e } = await supabase.from("questions").insert({
      exam_id:    examId,
      difficulty: difficulty ?? "Medium",
      sort_order: questions.length,
      content: {
        question_text:        questionText,
        options,
        correct_answer_index: correctIndex,
        topic_name:           topicName || undefined,
      },
    }).select().single();
    if (e) throw e;
    setQuestions(prev => [...prev, data]);
    setNewlyAdded(prev => new Set([...prev, data.id]));
    setShowManualForm(false);
  };

  const deleteQuestion = async (id) => {
    if (!confirm("למחוק שאלה זו?")) return;
    setDeleting(id);
    const { error: e } = await supabase.from("questions").delete().eq("id", id);
    if (e) { alert(e.message); setDeleting(null); return; }
    setQuestions(qs => qs.filter(q => q.id !== id));
    setDeleting(null);
  };

  const startEdit = (q) => {
    setEditing(q.id);
    setEditDraft({
      question_text: q.content?.question_text ?? "",
      options: [...(q.content?.options ?? ["","","",""])],
      correct_answer_index: q.content?.correct_answer_index ?? 0,
    });
  };

  const saveEdit = async (q) => {
    if (!editDraft.question_text.trim()) return;
    setEditSaving(true);
    const newContent = {
      ...q.content,
      question_text: editDraft.question_text.trim(),
      options: editDraft.options.map(o => o.trim()),
      correct_answer_index: editDraft.correct_answer_index,
    };
    const { error } = await supabase.from("questions").update({ content: newContent }).eq("id", q.id);
    if (error) { alert(error.message); setEditSaving(false); return; }
    setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, content: newContent } : x));
    setEditing(null);
    setEditDraft(null);
    setEditSaving(false);
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
      if (fnErr) {
        let msg = fnErr.message;
        try { const b = await fnErr.context?.json?.(); msg = b?.error ?? b?.message ?? msg; } catch (_) {}
        throw new Error(msg);
      }
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
      setTimeout(() => setGenError(""), 6000); // auto-clear after 6s
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const hasSubmissions = submissions.length > 0;

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/dashboard/exams" style={{ fontSize: 13, color: C.purple, textDecoration: "none" }}>← חזרה לרשימת המבחנים</Link>
      </div>

      {exam && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
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
            {questions.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => printExam(exam, questions)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.purple, cursor: "pointer", fontFamily: "inherit" }}>
                  🖨 הדפס שאלון
                </button>
                <button onClick={() => printAnswerKey(exam, questions)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.purple}`, background: C.purpleLight, color: C.purple, cursor: "pointer", fontFamily: "inherit" }}>
                  📋 מפתח תשובות
                </button>
                {submissions.length > 0 && (
                  <button onClick={() => printClassReport(exam, questions, submissions)}
                    style={{ fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.teal}`, background: C.tealLight, color: C.teal, cursor: "pointer", fontFamily: "inherit" }}>
                    📊 דוח כיתתי
                  </button>
                )}
                <button onClick={() => setShowManualForm(v => !v)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.amber}`, background: C.amberLight, color: C.amber, cursor: "pointer", fontFamily: "inherit" }}>
                  ✍️ הוסף שאלה
                </button>
                <a href={`/dashboard/exam/${examId}/live`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.red}`, background: C.redLight, color: C.red, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>
                  🔴 Live
                </a>
              </div>
            )}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: C.muted }}>כמות שאלות לייצור:</span>
              <select value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: "inherit", background: C.white }}>
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: 12, color: C.muted, marginRight: 4 }}>|</span>
              <span style={{ fontSize: 12, color: C.muted }}>מבחן חזרה:</span>
              <select value={retryCount} onChange={e => setRetryCount(Number(e.target.value))}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: "inherit", background: C.white }}>
                {[5, 8, 10, 15].map(n => <option key={n} value={n}>{n} שאלות</option>)}
              </select>
              <button onClick={createRetryExam} disabled={creatingRetry}
                style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.teal}`, background: C.tealLight, color: C.teal, cursor: creatingRetry ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                {creatingRetry ? (
                  <><span style={{ display: "inline-block", width: 11, height: 11, border: `2px solid #9FD9C7`, borderTopColor: C.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />יוצר...</>
                ) : "🔁 צור מבחן חזרה"}
              </button>
            </div>
          </div>

          {genError && (
            <div style={{ padding: "8px 16px", background: C.redLight, color: C.red, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{genError}</span>
              <button onClick={() => setGenError("")} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 0 0 8px" }}>×</button>
            </div>
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

      {/* ── MANUAL QUESTION FORM ── */}
      {showManualForm && (
        <ManualQuestionForm
          onSave={saveManualQuestion}
          onCancel={() => setShowManualForm(false)}
        />
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
                  {/* Image section */}
                  {c.image_url ? (
                    <div style={{ marginBottom: 12 }}>
                      <img src={c.image_url} alt="תמונת שאלה"
                        style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 10, border: `1px solid ${C.border}`, display: "block" }} />
                      <button onClick={() => removeImage(q)}
                        style={{ marginTop: 6, fontSize: 11, padding: "3px 10px", border: `1px solid #F09595`, background: C.redLight, color: C.red, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                        🗑 הסר תמונה
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 12px", border: `1px dashed ${C.purpleMid}`, borderRadius: 8, cursor: "pointer", color: C.purple, background: C.purpleLight }}>
                        {uploading === q.id ? (
                          <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.purpleMid}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />מעלה...</>
                        ) : "🖼 הוסף תמונה לשאלה"}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }}
                          disabled={!!uploading}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(q, f); e.target.value = ""; }} />
                      </label>
                      {uploadError && uploading === null && (
                        <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{uploadError}</div>
                      )}
                    </div>
                  )}

                  {/* ── VIEW MODE ── */}
                  {editing !== q.id && (
                    <>
                      <div style={{ fontSize: 13, color: C.text, marginBottom: 10, lineHeight: 1.5 }}>{c.question_text}</div>
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
                      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={e => { e.stopPropagation(); startEdit(q); }}
                          style={{ padding: "6px 14px", background: C.purpleLight, color: C.purple, border: `1px solid ${C.purpleMid}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                          ✏️ ערוך
                        </button>
                        <button onClick={() => deleteQuestion(q.id)} disabled={deleting === q.id}
                          style={{ padding: "6px 14px", background: C.redLight, color: C.red, border: `1px solid #F09595`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                          {deleting === q.id ? "מוחק..." : "🗑 מחק"}
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── EDIT MODE ── */}
                  {editing === q.id && editDraft && (
                    <div onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>טקסט השאלה</div>
                      <textarea
                        value={editDraft.question_text}
                        onChange={e => setEditDraft(d => ({ ...d, question_text: e.target.value }))}
                        rows={3}
                        style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.purple}`, borderRadius: 9, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", background: C.white, color: C.text, boxSizing: "border-box", marginBottom: 12, lineHeight: 1.5 }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>תשובות — לחץ על מספר לסמן נכונה</div>
                      {editDraft.options.map((opt, i) => {
                        const isCorrect = i === editDraft.correct_answer_index;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div onClick={() => setEditDraft(d => ({ ...d, correct_answer_index: i }))}
                              style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${isCorrect ? C.teal : C.border}`, background: isCorrect ? C.teal : "transparent", color: isCorrect ? "white" : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                              {i + 1}
                            </div>
                            <input
                              value={opt}
                              onChange={e => setEditDraft(d => ({ ...d, options: d.options.map((o, j) => j === i ? e.target.value : o) }))}
                              style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${isCorrect ? C.teal : C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none", background: isCorrect ? C.tealLight : C.bg, color: C.text, transition: "all 0.15s", direction: "rtl" }}
                            />
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 11, color: C.teal, marginBottom: 12 }}>✓ המספר המסומן בירוק = תשובה נכונה</div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditing(null); setEditDraft(null); }}
                          style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: C.muted }}>
                          ביטול
                        </button>
                        <button onClick={() => saveEdit(q)} disabled={editSaving || !editDraft.question_text.trim()}
                          style={{ padding: "7px 18px", background: editSaving ? C.purpleMid : C.purple, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {editSaving ? "שומר..." : "✓ שמור שינויים"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Manual Question Form ───────────────────────────────────
function ManualQuestionForm({ onSave, onCancel }) {
  const [questionText, setQuestionText] = useState("");
  const [options,      setOptions]      = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [difficulty,   setDifficulty]   = useState("Medium");
  const [topicName,    setTopicName]    = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const setOption = (i, val) => setOptions(opts => opts.map((o, j) => j === i ? val : o));

  const handleSave = async () => {
    if (!questionText.trim()) { setError("יש להזין טקסט שאלה"); return; }
    if (options.some(o => !o.trim())) { setError("יש למלא את כל 4 האפשרויות"); return; }
    setSaving(true); setError("");
    try {
      await onSave({ questionText: questionText.trim(), options: options.map(o => o.trim()), correctIndex, difficulty, topicName });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const LETTERS = "אבגד";
  const DIFF_OPTS = [{ v: "Easy", l: "קל" }, { v: "Medium", l: "בינוני" }, { v: "Hard", l: "קשה" }];

  return (
    <div style={{ background: C.white, border: `2px solid ${C.amber}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>✍️ שאלה ידנית חדשה</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted }}>✕</button>
      </div>

      {/* Question text */}
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>טקסט השאלה</div>
      <textarea value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="הכנס כאן את השאלה..."
        style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", direction: "rtl", resize: "vertical", minHeight: 70, background: C.bg, color: C.text, outline: "none", marginBottom: 14, boxSizing: "border-box" }} />

      {/* Options */}
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>אפשרויות תשובה — לחץ על הנכונה</div>
      {options.map((opt, i) => {
        const isCorrect = i === correctIndex;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div onClick={() => setCorrectIndex(i)}
              style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${isCorrect ? C.teal : C.border}`, background: isCorrect ? C.teal : "transparent", color: isCorrect ? "white" : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
              {LETTERS[i]}
            </div>
            <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`אפשרות ${LETTERS[i]}`}
              style={{ flex: 1, padding: "8px 12px", border: `1px solid ${isCorrect ? C.teal : C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", direction: "rtl", background: isCorrect ? C.tealLight : C.bg, color: C.text, outline: "none", transition: "all 0.15s" }} />
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: C.teal, marginBottom: 14 }}>✓ האות המסומנת בירוק היא התשובה הנכונה</div>

      {/* Difficulty + Topic */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>רמת קושי</div>
          <div style={{ display: "flex", gap: 6 }}>
            {DIFF_OPTS.map(d => (
              <button key={d.v} onClick={() => setDifficulty(d.v)}
                style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${difficulty === d.v ? C.purple : C.border}`, background: difficulty === d.v ? C.purpleLight : "transparent", color: difficulty === d.v ? C.purple : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>נושא (אופציונלי)</div>
          <input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="למשל: פוטוסינתזה"
            style={{ width: "100%", padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", direction: "rtl", background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: C.muted }}>ביטול</button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "8px 18px", background: saving ? C.amberLight : C.amber, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {saving ? "שומר..." : "✓ הוסף שאלה"}
        </button>
      </div>
    </div>
  );
}
