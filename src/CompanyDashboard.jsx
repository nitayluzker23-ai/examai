import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

export default function CompanyDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [exams,    setExams]    = useState([]);
  const [stats,    setStats]    = useState({ total: 0, submissions: 0, avgScore: null, completionRate: null });
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [copied,   setCopied]   = useState(null);
  const [mobile,   setMobile]   = useState(window.innerWidth < 600);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: exs } = await supabase.from("exams")
        .select("id,title,access_code,status,created_at,subject,group_name")
        .eq("workspace_id", user.id).order("created_at", { ascending: false });

      if (!exs?.length) { setLoading(false); return; }

      const { data: subs } = await supabase.from("submissions")
        .select("exam_id,score,student_name,completed_at")
        .in("exam_id", exs.map(e => e.id));

      const enriched = exs.map(e => ({
        ...e,
        subs: (subs ?? []).filter(s => s.exam_id === e.id),
      }));
      setExams(enriched);

      const allSubs = subs ?? [];
      const scores = allSubs.map(s => s.score).filter(s => s != null);
      setStats({
        total: exs.length,
        submissions: allSubs.length,
        avgScore: scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : null,
      });
      setLoading(false);
    })();
  }, [user]);

  const deleteExam = async (id) => {
    if (!confirm("למחוק את הבחינה? הפעולה אינה הפיכה.")) return;
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

  const orgName  = profile?.full_name || "הארגון";
  const industry = profile?.subject || "הנושא";

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: mobile ? "20px 16px" : "28px 24px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", maxWidth: 760, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>🏢 מרכז הבחינות</h1>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{orgName} · {industry}</div>
      </div>

      {/* CTA */}
      <button onClick={() => navigate("/dashboard/new")}
        style={{ width: "100%", padding: "18px 24px", background: `linear-gradient(135deg, ${C.purple} 0%, #211F1A 100%)`, color: "white", border: "none", borderRadius: 18, fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, boxShadow: "0 6px 24px rgba(43,41,37,0.18)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <span style={{ fontSize: 26 }}>📋</span>
        <div style={{ textAlign: "right" }}>
          <div>צור בחינת הכשרה חדשה</div>
          <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>העלה חומר הכשרה וצור מבחן לעובדים</div>
        </div>
      </button>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "בחינות", value: stats.total, icon: "📋", color: C.purple, bg: C.purpleLight },
          { label: "הגשות",  value: stats.submissions, icon: "✍️", color: C.teal, bg: C.tealLight },
          { label: "ממוצע",  value: stats.avgScore != null ? `${stats.avgScore}%` : "—", icon: "📊", color: C.amber, bg: C.amberLight },
          { label: "פעילות", value: exams.filter(e => e.status === "published").length, icon: "🟢", color: C.teal, bg: C.tealLight },
        ].map((s, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 14, padding: "14px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Exams table */}
      {exams.length === 0 ? (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 36, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>אין בחינות עדיין</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>צור בחינת הכשרה ראשונה לעובדים שלך</div>
          <button onClick={() => navigate("/dashboard/new")}
            style={{ padding: "11px 28px", background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            צור בחינה ראשונה
          </button>
        </div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📋 בחינות הכשרה ({exams.length})</div>
          </div>
          {exams.map(e => {
            const completionRate = e.subs.length;
            const avgScore = e.subs.length
              ? Math.round(e.subs.filter(s => s.score != null).reduce((a, s) => a + s.score, 0) / e.subs.filter(s => s.score != null).length)
              : null;
            return (
              <div key={e.id} style={{ padding: "13px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {e.subject}{e.group_name ? ` · ${e.group_name}` : ""}
                    {" · "}{new Date(e.created_at).toLocaleDateString("he-IL")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: C.muted, background: C.bg, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.border}` }}>
                    {completionRate} הגשות
                  </span>
                  {avgScore != null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: avgScore >= 70 ? C.teal : C.red, background: avgScore >= 70 ? C.tealLight : C.redLight, padding: "3px 10px", borderRadius: 20 }}>
                      ∅ {avgScore}%
                    </span>
                  )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
