import { useState, useEffect } from "react";
import { supabase } from "./App";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

export default function ExamsList() {
  const [exams,   setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);

  useEffect(() => { fetchExams(); }, []);

  const fetchExams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exams")
      .select("*, questions(count)")
      .order("created_at", { ascending: false });
    if (!error) setExams(data ?? []);
    setLoading(false);
  };

  const examUrl = (code) => `${window.location.origin}/exam/${code}`;

  const copyLink = (code) => {
    navigator.clipboard?.writeText(examUrl(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareWhatsApp = (exam) => {
    const url = examUrl(exam.access_code);
    const msg = `שלום! הנה לינק למבחן "${exam.title}" 📝\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const toggleStatus = async (exam) => {
    const newStatus = exam.status === "published" ? "draft" : "published";
    await supabase.from("exams").update({ status: newStatus }).eq("id", exam.id);
    fetchExams();
  };

  const deleteExam = async (id) => {
    if (!confirm("למחוק את המבחן?")) return;
    await supabase.from("exams").delete().eq("id", id);
    fetchExams();
  };

  const modeLabel = (config) => {
    if (!config) return "";
    if (config.mode === "flexible") return `גמיש · ${config.total_minutes} דק׳`;
    if (config.mode === "timed")    return `מתוזמן · ${config.seconds_per_question} שנ׳/שאלה`;
    if (config.mode === "sessions") return `סשנים · ${config.sessions?.length} פרקים`;
    return "";
  };

  return (
    <div style={{ padding: 20, fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>המבחנים שלי</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{exams.length} מבחנים</div>
        </div>
        <a href="/dashboard/new" style={{ padding: "9px 16px", background: C.purple, color: "white", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          + מבחן חדש
        </a>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && exams.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", background: C.white, borderRadius: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>אין מבחנים עדיין</div>
          <div style={{ fontSize: 13, color: C.muted }}>לחץ על "מבחן חדש" כדי להתחיל</div>
        </div>
      )}

      {exams.map(exam => {
        const qCount = exam.questions?.[0]?.count ?? 0;
        const isPublished = exam.status === "published";
        return (
          <div key={exam.id} style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 18, marginBottom: 10, boxShadow: "0 1px 6px rgba(83,74,183,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{exam.subject} · {modeLabel(exam.config)}</div>
              </div>
              <span style={{ background: isPublished ? C.tealLight : C.amberLight, color: isPublished ? C.teal : C.amber, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                {isPublished ? "פעיל" : "טיוטה"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <span style={{ background: C.bg, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.muted }}>{qCount} שאלות</span>
              {exam.access_code && (
                <span style={{ background: C.purpleLight, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.purple, fontFamily: "monospace", fontWeight: 600 }}>
                  {exam.access_code}
                </span>
              )}
              <span style={{ background: C.bg, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.muted }}>
                {new Date(exam.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {exam.access_code && (
                <>
                  <button onClick={() => copyLink(exam.access_code)}
                    style={{ padding: "7px 14px", background: copied === exam.access_code ? C.tealLight : C.purpleLight, color: copied === exam.access_code ? C.teal : C.purple, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    {copied === exam.access_code ? "✓ הועתק!" : "🔗 העתק לינק"}
                  </button>
                  <button onClick={() => shareWhatsApp(exam)}
                    style={{ padding: "7px 14px", background: "#E7F9EF", color: "#128C7E", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    📲 שלח בוואטסאפ
                  </button>
                </>
              )}
              <button onClick={() => toggleStatus(exam)}
                style={{ padding: "7px 14px", background: isPublished ? C.amberLight : C.tealLight, color: isPublished ? C.amber : C.teal, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                {isPublished ? "העבר לטיוטה" : "פרסם"}
              </button>
              <button onClick={() => window.location.href=`/dashboard/exam/${exam.id}/questions`}
                style={{ padding: "7px 14px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                ✏️ עריכת שאלות
              </button>
              <button onClick={() => window.open(`/exam/${exam.access_code}`, "_blank")}
                style={{ padding: "7px 14px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                תצוגת תלמיד
              </button>
              <button onClick={() => deleteExam(exam.id)}
                style={{ padding: "7px 14px", background: C.redLight, color: C.red, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginRight: "auto" }}>
                מחק
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
