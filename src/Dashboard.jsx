import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";
import StudentDashboard from "./StudentDashboard";
import ParentDashboard  from "./ParentDashboard";
import CompanyDashboard from "./CompanyDashboard";
import TutorDashboard   from "./TutorDashboard";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

// ── Demo preview data ──────────────────────────────────────
const DEMO_EXAMS = [
  { title: "מבחן סוף שנה — ביולוגיה", subject: "ביולוגיה", group_name: "י׳2", status: "published", submissions: 24 },
  { title: "חזרה לפרק 3 — גנטיקה",    subject: "ביולוגיה", group_name: "י׳2", status: "published", submissions: 18 },
  { title: "מבחן אמצע שנה — מתמטיקה", subject: "מתמטיקה", group_name: "ט׳1", status: "draft",     submissions: 0  },
];

const DEMO_STUDENTS = ["יעל כהן","אבי לוי","מיכל ברק","דניאל שפירא","רונית גולן","עמית פרץ"];

// ── Helpers ────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
    background: status === "published" ? C.tealLight : C.amberLight,
    color:      status === "published" ? C.teal      : C.amber,
  }}>
    {status === "published" ? "פורסם" : "טיוטה"}
  </span>
);

// Router: pick the dashboard by role. Only calls useAuth (one hook) before
// returning, so no Rules-of-Hooks violation regardless of which one renders.
export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.school_type;
  if (role === "student")        return <StudentDashboard />;
  if (role === "parent")         return <ParentDashboard />;
  if (role === "company")        return <CompanyDashboard />;
  if (role === "private_tutor")  return <TutorDashboard />;
  return <TeacherDashboard />;
}

function TeacherDashboard() {
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [exams,      setExams]      = useState([]);
  const [students,   setStudents]   = useState([]);
  const [stats,      setStats]      = useState({ exams: 0, submissions: 0, students: 0 });
  const [loading,    setLoading]    = useState(true);
  const [hideDemo,   setHideDemo]   = useState(profile?.hide_demo ?? false);
  const [deleting,   setDeleting]   = useState(null);

  // Student management
  const [showAddStu, setShowAddStu] = useState(false);
  const [stuName,    setStuName]    = useState("");
  const [stuNotes,   setStuNotes]   = useState("");
  const [addingStu,  setAddingStu]  = useState(false);

  useEffect(() => {
    if (profile) setHideDemo(profile.hide_demo ?? false);
  }, [profile]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [
      { data: examData },
      { data: stuData },
      { data: subData },
    ] = await Promise.all([
      supabase.from("exams").select("id,title,subject,group_name,status,access_code,created_at").eq("workspace_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("students").select("id,name,notes,created_at").eq("workspace_id", user.id).order("name"),
      supabase.from("submissions").select("id,exam_id").in("exam_id",
        (await supabase.from("exams").select("id").eq("workspace_id", user.id)).data?.map(e => e.id) ?? []
      ),
    ]);
    const exs = examData ?? [];
    const sts = stuData  ?? [];
    const subs = subData ?? [];
    setExams(exs);
    setStudents(sts);
    setStats({ exams: exs.length, submissions: subs.length, students: sts.length });
    setLoading(false);
  };

  const dismissDemo = async () => {
    setHideDemo(true);
    await supabase.from("profiles").update({ hide_demo: true }).eq("id", user.id);
    fetchProfile(user.id);
  };

  const deleteExam = async (id) => {
    if (!confirm("למחוק את המבחן? הפעולה אינה הפיכה.")) return;
    setDeleting(id);
    await supabase.from("questions").delete().eq("exam_id", id);
    await supabase.from("submissions").delete().eq("exam_id", id);
    await supabase.from("exams").delete().eq("id", id);
    setExams(e => e.filter(x => x.id !== id));
    setStats(s => ({ ...s, exams: s.exams - 1 }));
    setDeleting(null);
  };

  const deleteStudent = async (id) => {
    if (!confirm("למחוק את התלמיד?")) return;
    await supabase.from("class_students").delete().eq("student_id", id);
    await supabase.from("students").delete().eq("id", id);
    setStudents(s => s.filter(x => x.id !== id));
    setStats(s => ({ ...s, students: s.students - 1 }));
  };

  const addStudent = async () => {
    if (!stuName.trim()) return;
    setAddingStu(true);
    const { data, error } = await supabase.from("students").insert({
      workspace_id: user.id,
      name: stuName.trim(),
      notes: stuNotes.trim() || null,
    }).select().single();
    if (!error && data) {
      setStudents(s => [...s, data]);
      setStats(s => ({ ...s, students: s.students + 1 }));
      setStuName(""); setStuNotes(""); setShowAddStu(false);
    }
    setAddingStu(false);
  };

  const hasRealData = exams.length > 0 || students.length > 0;
  const showDemo = !hideDemo && !hasRealData;

  const firstName = profile?.full_name?.split(" ")[0] || "";

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Noto Sans Hebrew',sans-serif" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl", maxWidth: 860, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
          {firstName ? `שלום, ${firstName} 👋` : "לוח בקרה"}
        </h1>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>ניהול מבחנים ותלמידים</div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "מבחנים",  value: showDemo ? 3  : stats.exams,       icon: "📋", color: C.purple, bg: C.purpleLight },
          { label: "הגשות",   value: showDemo ? 42 : stats.submissions,  icon: "✍️", color: C.teal,   bg: C.tealLight  },
          { label: "תלמידים", value: showDemo ? 6  : stats.students,     icon: "👥", color: C.amber,  bg: C.amberLight },
        ].map((s, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 14, padding: "16px 14px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── DEMO BANNER ── */}
      {showDemo && (
        <div style={{ background: C.white, border: `2px dashed ${C.purpleMid}`, borderRadius: 18, marginBottom: 24, overflow: "hidden", position: "relative" }}>
          <div style={{ background: C.purpleLight, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>✨ כך ייראה הדשבורד שלך עם נתונים</div>
            <button onClick={dismissDemo}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
          {/* Demo exams */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>מבחנים אחרונים</div>
            {DEMO_EXAMS.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: C.bg, borderRadius: 10, marginBottom: 7, opacity: 0.75 }}>
                <span style={{ fontSize: 13, flex: 1, color: C.text }}>{e.title}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{e.group_name}</span>
                <StatusBadge status={e.status} />
                <span style={{ fontSize: 11, color: C.muted }}>{e.submissions} הגשות</span>
              </div>
            ))}
            {/* Demo students */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: "14px 0 10px" }}>תלמידים</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DEMO_STUDENTS.map((s, i) => (
                <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 13, color: C.text, opacity: 0.75 }}>
                  {s}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button onClick={() => navigate("/dashboard/new")}
                style={{ flex: 1, padding: "11px 0", background: C.purple, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                + צור מבחן ראשון
              </button>
              <button onClick={dismissDemo}
                style={{ padding: "11px 18px", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                הסתר תצוגה זו
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REAL EXAMS ── */}
      {!showDemo && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📋 מבחנים ({exams.length})</div>
            <button onClick={() => navigate("/dashboard/new")}
              style={{ padding: "7px 14px", background: C.purple, color: "white", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              + חדש
            </button>
          </div>
          {exams.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 14 }}>
              אין מבחנים עדיין —{" "}
              <span onClick={() => navigate("/dashboard/new")} style={{ color: C.purple, cursor: "pointer", fontWeight: 600 }}>צור מבחן ראשון</span>
            </div>
          ) : (
            <div>
              {exams.map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{e.subject}{e.group_name ? ` · ${e.group_name}` : ""}</div>
                  </div>
                  <StatusBadge status={e.status} />
                  {e.access_code && (
                    <code style={{ fontSize: 11, background: C.bg, padding: "2px 7px", borderRadius: 5, color: C.purple, letterSpacing: 1 }}>{e.access_code}</code>
                  )}
                  <button onClick={() => navigate(`/dashboard/exams/${e.id}/questions`)}
                    style={{ padding: "5px 10px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    ✏️ ערוך
                  </button>
                  <button onClick={() => deleteExam(e.id)} disabled={deleting === e.id}
                    style={{ padding: "5px 10px", background: C.redLight, color: C.red, border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    {deleting === e.id ? "..." : "🗑"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STUDENTS ── */}
      {!showDemo && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>👥 תלמידים ({students.length})</div>
            <button onClick={() => setShowAddStu(v => !v)}
              style={{ padding: "7px 14px", background: showAddStu ? C.bg : C.teal, color: showAddStu ? C.muted : "white", border: showAddStu ? `1px solid ${C.border}` : "none", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {showAddStu ? "ביטול" : "+ הוסף תלמיד"}
            </button>
          </div>

          {/* Add student form */}
          {showAddStu && (
            <div style={{ padding: "14px 18px", background: C.tealLight, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>שם</div>
                <input value={stuName} onChange={e => setStuName(e.target.value)} onKeyDown={e => e.key === "Enter" && addStudent()}
                  placeholder="שם התלמיד" autoFocus
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>הערה (אופציונלי)</div>
                <input value={stuNotes} onChange={e => setStuNotes(e.target.value)}
                  placeholder="כיתה, מספר, מייל..."
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white, boxSizing: "border-box" }} />
              </div>
              <button onClick={addStudent} disabled={!stuName.trim() || addingStu}
                style={{ padding: "8px 18px", background: stuName.trim() ? C.teal : C.muted, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {addingStu ? "..." : "✓ הוסף"}
              </button>
            </div>
          )}

          {students.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: C.muted, fontSize: 14 }}>
              אין תלמידים עדיין
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 18px" }}>
              {students.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 13 }}>
                  <span style={{ color: C.text }}>{s.name}</span>
                  {s.notes && <span style={{ fontSize: 11, color: C.muted }}>· {s.notes}</span>}
                  <button onClick={() => deleteStudent(s.id)}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px", display: "flex", alignItems: "center" }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick actions when has real data */}
      {hasRealData && (
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/dashboard/new")}
            style={{ flex: 1, padding: "12px 0", background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minWidth: 140 }}>
            + מבחן חדש
          </button>
          <button onClick={() => navigate("/dashboard/exams")}
            style={{ flex: 1, padding: "12px 0", background: C.white, color: C.purple, border: `1.5px solid ${C.purple}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minWidth: 140 }}>
            כל המבחנים
          </button>
        </div>
      )}
    </div>
  );
}
