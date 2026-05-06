import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "./App";

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

export default function ExamQuestionsPage() {
  const { examId } = useParams();
  const [exam,      setExam]      = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [expanded,  setExpanded]  = useState(null);
  const [deleting,  setDeleting]  = useState(null);

  useEffect(() => { load(); }, [examId]);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [{ data: examData, error: eErr }, { data: qData, error: qErr }] = await Promise.all([
        supabase.from("exams").select("id,title,status,access_code,config").eq("id", examId).single(),
        supabase.from("questions").select("*").eq("exam_id", examId).order("sort_order"),
      ]);
      if (eErr) throw eErr;
      if (qErr) throw qErr;
      setExam(examData);
      setQuestions(qData ?? []);
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

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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

      {!loading && questions.length === 0 && !error && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, color: C.muted }}>אין שאלות במבחן זה עדיין</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {questions.map((q, idx) => {
          const c = q.content ?? {};
          const isOpen = expanded === q.id;
          const diff = q.difficulty ?? "Medium";
          return (
            <div key={q.id}
              style={{ background: C.white, border: `1px solid ${isOpen ? C.purple : C.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}
                onClick={() => setExpanded(isOpen ? null : q.id)}>
                <span style={{ fontSize: 12, color: C.muted, minWidth: 24, flexShrink: 0 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 1.5 }}>{c.question_text}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0, ...DIFF_STYLE[diff] }}>
                  {DIFF_LABEL[diff] ?? diff}
                </span>
                <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px 14px" }}>
                  {c.options?.map((opt, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", borderRadius: 8, marginBottom: 4,
                      background: i === c.correct_answer_index ? C.tealLight : C.bg,
                      border: `1px solid ${i === c.correct_answer_index ? "#9FD9C7" : "transparent"}` }}>
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
