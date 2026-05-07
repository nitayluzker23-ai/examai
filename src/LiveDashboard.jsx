import { useState, useEffect, useRef, useCallback } from "react";
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

const REFRESH_INTERVAL = 15000; // 15 seconds

export default function LiveDashboard() {
  const { examId } = useParams();
  const [exam,        setExam]        = useState(null);
  const [stats,       setStats]       = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [questions,   setQuestions]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown,   setCountdown]   = useState(REFRESH_INTERVAL / 1000);
  const intervalRef = useRef(null);
  const countRef    = useRef(null);

  const load = useCallback(async () => {
    try {
      const [
        { data: examData },
        { data: statsData },
        { data: subData },
        { data: qData },
      ] = await Promise.all([
        supabase.from("exams").select("id,title,subject,access_code,config").eq("id", examId).single(),
        supabase.from("exam_live_stats").select("*").eq("exam_id", examId).single(),
        supabase.from("submissions").select("id,student_name,score,completed_at,answers").eq("exam_id", examId).order("completed_at", { ascending: false }),
        supabase.from("questions").select("id,content,source_topic_id,difficulty").eq("exam_id", examId).order("sort_order"),
      ]);
      if (examData)  setExam(examData);
      if (statsData) setStats(statsData);
      setSubmissions(subData ?? []);
      setQuestions(qData ?? []);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);
    countRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1));
    }, 1000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countRef.current);
    };
  }, [load]);

  // Calculate per-question error rates
  const questionStats = questions.map(q => {
    let total = 0, wrong = 0;
    for (const sub of submissions) {
      const a = (sub.answers ?? []).find(a => a.question_id === q.id);
      if (a) {
        total++;
        if (a.selected_index !== q.content?.correct_answer_index) wrong++;
      }
    }
    return { ...q, total, wrong, errPct: total > 0 ? Math.round((wrong / total) * 100) : null };
  }).filter(q => q.total > 0).sort((a, b) => b.errPct - a.errPct);

  const avg   = stats?.avg_score ?? 0;
  const total = stats?.total_submissions ?? 0;
  const avgColor = avg >= 80 ? C.teal : avg >= 60 ? C.amber : C.red;

  return (
    <div style={{ padding: "20px 16px", direction: "rtl", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <Link to={`/dashboard/exam/${examId}/questions`} style={{ fontSize: 13, color: C.purple, textDecoration: "none" }}>← חזרה לשאלות</Link>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>
            🔴 <span style={{ color: C.red }}>LIVE</span> — {exam?.title ?? "טוען..."}
          </div>
          {exam?.access_code && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              קוד: <code style={{ background: C.purpleLight, padding: "1px 6px", borderRadius: 4, color: C.purple }}>{exam.access_code}</code>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, textAlign: "left" }}>
            {lastRefresh && <>עדכון אחרון: {lastRefresh.toLocaleTimeString("he-IL")}<br /></>}
            <span style={{ color: C.purple }}>מתרענן בעוד {countdown} שנ׳</span>
          </div>
          <button onClick={load} style={{ padding: "7px 14px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            🔄 רענן
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : total === 0 ? (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>ממתין להגשות...</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>הדף מתרענן אוטומטית כל 15 שניות</div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "הגשות",    value: total,                  icon: "✍",  color: C.purple, bg: C.purpleLight },
              { label: "ממוצע",    value: `${avg}%`,              icon: "📊", color: avgColor, bg: avg >= 80 ? C.tealLight : avg >= 60 ? C.amberLight : C.redLight },
              { label: "עוברים",   value: stats?.passing_count ?? 0, icon: "✅", color: C.teal,   bg: C.tealLight },
              { label: "נכשלים",   value: total - (stats?.passing_count ?? 0), icon: "❌", color: C.red, bg: C.redLight },
            ].map(card => (
              <div key={card.label} style={{ background: card.bg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 22 }}>{card.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: card.color, lineHeight: 1.2, marginTop: 4 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: card.color, opacity: 0.8, marginTop: 2 }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>

            {/* Hardest questions */}
            {questionStats.length > 0 && (
              <div style={{ flex: "0 0 280px" }}>
                <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>🔥 שאלות הכי קשות</div>
                  {questionStats.slice(0, 6).map((q, i) => (
                    <div key={q.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 8 }}>
                          {i + 1}. {q.content?.question_text?.slice(0, 45)}{q.content?.question_text?.length > 45 ? "..." : ""}
                        </span>
                        <span style={{ color: q.errPct >= 60 ? C.red : q.errPct >= 40 ? C.amber : C.teal, fontWeight: 700, flexShrink: 0 }}>
                          {q.errPct}%
                        </span>
                      </div>
                      <div style={{ height: 5, background: C.bg, borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${q.errPct}%`, background: q.errPct >= 60 ? C.red : q.errPct >= 40 ? C.amber : C.teal, borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student list */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
                  תלמידים שסיימו ({submissions.length})
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {["#", "שם תלמיד", "ציון", "שעת הגשה"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: C.muted, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub, i) => {
                        const score = sub.score ?? 0;
                        const col = score >= 80 ? C.teal : score >= 60 ? C.amber : C.red;
                        return (
                          <tr key={sub.id} style={{ borderBottom: i < submissions.length - 1 ? `1px solid ${C.border}` : "none" }}>
                            <td style={{ padding: "9px 12px", color: C.muted, fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: "9px 12px", fontWeight: 500 }}>{sub.student_name ?? "—"}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ fontWeight: 700, color: col, background: col === C.teal ? C.tealLight : col === C.amber ? C.amberLight : C.redLight, padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                                {score}%
                              </span>
                            </td>
                            <td style={{ padding: "9px 12px", color: C.muted, fontSize: 11 }}>
                              {sub.completed_at ? new Date(sub.completed_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
