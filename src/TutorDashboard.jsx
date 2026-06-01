import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ClipboardList, Users, BarChart3 } from "lucide-react";
import { supabase, useAuth } from "./App";
import AccountSummary from "./AccountSummary";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

export default function TutorDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [exams,    setExams]    = useState([]);
  const [students, setStudents] = useState([]);
  const [stats,    setStats]    = useState({ exams: 0, students: 0, avgScore: null });
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [copied,   setCopied]   = useState(null);
  const [showAddStu, setShowAddStu] = useState(false);
  const [stuName,  setStuName]  = useState("");
  const [addingStu, setAddingStu] = useState(false);
  const [mobile,   setMobile]   = useState(window.innerWidth < 600);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: exs }, { data: stus }] = await Promise.all([
        supabase.from("exams").select("id,title,access_code,status,created_at,subject,group_name")
          .eq("workspace_id", user.id).order("created_at", { ascending: false }).limit(15),
        supabase.from("students").select("id,name,notes,created_at")
          .eq("workspace_id", user.id).order("name"),
      ]);

      const exsList = exs ?? [];
      if (exsList.length) {
        const { data: subs } = await supabase.from("submissions")
          .select("exam_id,score,student_name,completed_at")
          .in("exam_id", exsList.map(e => e.id));
        const enriched = exsList.map(e => ({ ...e, subs: (subs ?? []).filter(s => s.exam_id === e.id) }));
        const scores = (subs ?? []).map(s => s.score).filter(s => s != null);
        setExams(enriched);
        setStats({
          exams: exsList.length,
          students: (stus ?? []).length,
          avgScore: scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : null,
        });
      }
      setStudents(stus ?? []);
      setLoading(false);
    })();
  }, [user]);

  const addStudent = async () => {
    if (!stuName.trim()) return;
    setAddingStu(true);
    const { data, error } = await supabase.from("students").insert({ workspace_id: user.id, name: stuName.trim() }).select().single();
    if (!error && data) { setStudents(s => [...s, data]); setStuName(""); setShowAddStu(false); setStats(s => ({ ...s, students: s.students + 1 })); }
    setAddingStu(false);
  };

  const deleteStudent = async (id) => {
    await supabase.from("class_students").delete().eq("student_id", id);
    await supabase.from("students").delete().eq("id", id);
    setStudents(s => s.filter(x => x.id !== id));
    setStats(s => ({ ...s, students: s.students - 1 }));
  };

  const deleteExam = async (id) => {
    if (!confirm("למחוק את המבחן?")) return;
    setDeleting(id);
    await supabase.from("questions").delete().eq("exam_id", id);
    await supabase.from("submissions").delete().eq("exam_id", id);
    await supabase.from("exams").delete().eq("id", id);
    setExams(e => e.filter(x => x.id !== id));
    setDeleting(null);
  };

  const copyLink = (code) => {
    navigator.clipboard?.writeText(`${window.location.origin}/exam/${code}`);
    setCopied(code); setTimeout(() => setCopied(null), 2000);
  };

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const subject   = profile?.subject || "המקצוע";

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: mobile ? "20px 16px" : "28px 24px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", maxWidth: 720, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>
          {firstName ? `שלום, ${firstName}` : "לוח הבקרה"}
        </h1>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>מורה פרטי · {subject}</div>
      </div>

      <AccountSummary stats={[
        { label: "מבחנים", value: stats.exams },
        { label: "תלמידים", value: stats.students },
        { label: "ממוצע", value: stats.avgScore ?? "—" },
      ]} />

      {/* CTA */}
      <button onClick={() => navigate("/dashboard/new")}
        style={{ width: "100%", padding: "18px 24px", background: `linear-gradient(135deg, ${C.purple} 0%, #211F1A 100%)`, color: "white", border: "none", borderRadius: 18, fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, boxShadow: "0 6px 24px rgba(43,41,37,0.18)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Sparkles size={24} strokeWidth={1.75} />
        <div style={{ textAlign: "right" }}>
          <div>צור מבחן לתלמיד</div>
          <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>מחומר לימוד — ב-AI, תוך שניות</div>
        </div>
      </button>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "מבחנים",  value: stats.exams, Icon: ClipboardList, color: C.purple, bg: C.purpleLight },
          { label: "תלמידים", value: stats.students, Icon: Users, color: C.teal, bg: C.tealLight },
          { label: "ממוצע",   value: stats.avgScore != null ? `${stats.avgScore}` : "—", Icon: BarChart3, color: C.amber, bg: C.amberLight },
        ].map((s, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 14, padding: "14px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 7 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.Icon size={18} color={s.color} strokeWidth={1.75} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Students */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}><Users size={15} color={C.muted} /> תלמידים ({students.length})</div>
          <button onClick={() => setShowAddStu(v => !v)}
            style={{ padding: "6px 14px", background: showAddStu ? C.bg : C.teal, color: showAddStu ? C.muted : "white", border: showAddStu ? `1px solid ${C.border}` : "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {showAddStu ? "ביטול" : "+ הוסף"}
          </button>
        </div>
        {showAddStu && (
          <div style={{ padding: "12px 18px", background: C.tealLight, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
            <input value={stuName} onChange={e => setStuName(e.target.value)} onKeyDown={e => e.key === "Enter" && addStudent()}
              placeholder="שם התלמיד" autoFocus
              style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white }} />
            <button onClick={addStudent} disabled={!stuName.trim() || addingStu}
              style={{ padding: "8px 16px", background: C.teal, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {addingStu ? "..." : "✓ הוסף"}
            </button>
          </div>
        )}
        {students.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>הוסף תלמידים לניהול מעקב</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 18px" }}>
            {students.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 13 }}>
                <span style={{ color: C.text }}>{s.name}</span>
                <button onClick={() => deleteStudent(s.id)}
                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px" }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent exams */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={15} color={C.muted} /> מבחנים אחרונים</div>
          <button onClick={() => navigate("/dashboard/exams")}
            style={{ padding: "5px 12px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            כולם →
          </button>
        </div>
        {exams.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>אין מבחנים עדיין</div>
        ) : exams.slice(0,5).map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{e.subs.length} הגשות · {e.subject}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => copyLink(e.access_code)}
                style={{ padding: "5px 10px", background: copied === e.access_code ? C.tealLight : C.purpleLight, color: copied === e.access_code ? C.teal : C.purple, border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {copied === e.access_code ? "✓" : `📎 ${e.access_code}`}
              </button>
              <button onClick={() => navigate(`/dashboard/exams/${e.id}/questions`)}
                style={{ padding: "5px 10px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
              <button onClick={() => deleteExam(e.id)} disabled={deleting === e.id}
                style={{ padding: "5px 10px", background: C.redLight, color: C.red, border: "none", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                {deleting === e.id ? "..." : "🗑"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
