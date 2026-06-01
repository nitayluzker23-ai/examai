import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, ClipboardList, BarChart3, Trophy, Users } from "lucide-react";
import { supabase, useAuth } from "./App";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

function ScoreBadge({ score }) {
  const color = score >= 85 ? C.teal : score >= 60 ? C.amber : C.red;
  const bg    = score >= 85 ? C.tealLight : score >= 60 ? C.amberLight : C.redLight;
  return <div style={{ background: bg, color, borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 800 }}>{score}</div>;
}

export default function ParentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [exams,   setExams]   = useState([]);
  const [stats,   setStats]   = useState({ total: 0, avg: null, best: null });
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);
  const [mobile,  setMobile]  = useState(window.innerWidth < 600);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: exs } = await supabase.from("exams")
        .select("id,title,access_code,status,created_at,subject")
        .eq("workspace_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (!exs?.length) { setLoading(false); return; }

      const { data: subs } = await supabase.from("submissions")
        .select("exam_id,score,student_name,completed_at")
        .in("exam_id", exs.map(e => e.id)).order("completed_at", { ascending: false });

      const enriched = exs.map(e => ({
        ...e,
        subs: (subs ?? []).filter(s => s.exam_id === e.id),
      }));
      setExams(enriched);

      const scores = (subs ?? []).map(s => s.score).filter(s => s != null);
      setStats({
        total: exs.length,
        avg:  scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : null,
        best: scores.length ? Math.max(...scores) : null,
      });
      setLoading(false);
    })();
  }, [user]);

  const copyLink = (code) => {
    navigator.clipboard?.writeText(`${window.location.origin}/exam/${code}`);
    setCopied(code); setTimeout(() => setCopied(null), 2000);
  };

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const childSubject = profile?.subject || "הנושא שנבחר";

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: mobile ? "20px 16px" : "28px 24px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", maxWidth: 680, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>
          {firstName ? `שלום, ${firstName}` : "לוח הבקרה"}
        </h1>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>מבחנים לילדך ב{childSubject}</div>
      </div>

      {/* CTA */}
      <button onClick={() => navigate("/dashboard/new")}
        style={{ width: "100%", padding: "18px 24px", background: `linear-gradient(135deg, ${C.teal} 0%, #0a5240 100%)`, color: "white", border: "none", borderRadius: 18, fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, boxShadow: "0 6px 24px rgba(15,110,86,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <PenLine size={24} strokeWidth={1.75} />
        <div style={{ textAlign: "right" }}>
          <div>צור מבחן לילד</div>
          <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>העלה חומר לימוד ושלח קישור</div>
        </div>
      </button>

      {/* Stats */}
      {stats.total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "מבחנים", value: stats.total, Icon: ClipboardList, color: C.purple, bg: C.purpleLight },
            { label: "ממוצע",  value: stats.avg ?? "—", Icon: BarChart3, color: C.teal, bg: C.tealLight },
            { label: "שיא",    value: stats.best ?? "—", Icon: Trophy, color: C.amber, bg: C.amberLight },
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
      )}

      {/* How it works (empty state) */}
      {exams.length === 0 && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Users size={40} color={C.purpleMid} strokeWidth={1.5} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>איך זה עובד?</div>
          {[
            { n: "1", t: "צור מבחן מחומר הלימוד של הילד" },
            { n: "2", t: "שלח לו קישור או קוד גישה" },
            { n: "3", t: "ראה את התוצאות שלו כאן" },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", textAlign: "right" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.teal, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{s.n}</div>
              <span style={{ fontSize: 14, color: C.text }}>{s.t}</span>
            </div>
          ))}
          <button onClick={() => navigate("/dashboard/new")}
            style={{ marginTop: 20, padding: "11px 28px", background: C.teal, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            צור מבחן ראשון
          </button>
        </div>
      )}

      {/* Exams list */}
      {exams.length > 0 && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ClipboardList size={15} color={C.muted} /> מבחנים שיצרת ({exams.length})</span>
          </div>
          {exams.map(e => {
            const lastSub = e.subs?.[0];
            return (
              <div key={e.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {new Date(e.created_at).toLocaleDateString("he-IL")}
                      {e.subs.length > 0 && ` · ${e.subs.length} הגשות`}
                    </div>
                  </div>
                  {lastSub?.score != null && <ScoreBadge score={lastSub.score} />}
                  <button onClick={() => copyLink(e.access_code)}
                    style={{ padding: "5px 10px", background: copied === e.access_code ? C.tealLight : C.purpleLight, color: copied === e.access_code ? C.teal : C.purple, border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    {copied === e.access_code ? "✓ הועתק" : `📎 ${e.access_code}`}
                  </button>
                  <button onClick={() => navigate(`/dashboard/exams/${e.id}/questions`)}
                    style={{ padding: "5px 10px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    ✏️
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
