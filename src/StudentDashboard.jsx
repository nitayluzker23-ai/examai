import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, FolderOpen, ClipboardList, BarChart3, Trophy } from "lucide-react";
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

function ScoreBadge({ score }) {
  const color = score >= 85 ? C.teal : score >= 60 ? C.amber : C.red;
  const bg    = score >= 85 ? C.tealLight : score >= 60 ? C.amberLight : C.redLight;
  return (
    <div style={{ background: bg, color, borderRadius: 20, padding: "4px 14px", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
      {score}
    </div>
  );
}

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [history,  setHistory]  = useState([]);
  const [stats,    setStats]    = useState({ total: 0, avg: null, best: null });
  const [loading,  setLoading]  = useState(true);
  const [mobile,   setMobile]   = useState(window.innerWidth < 600);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: exams } = await supabase
        .from("exams")
        .select("id,title,access_code,created_at,subject")
        .eq("workspace_id", user.id)
        .eq("is_self_test", true)
        .order("created_at", { ascending: false });

      if (!exams?.length) { setLoading(false); return; }

      const { data: subs } = await supabase
        .from("submissions")
        .select("exam_id,score,completed_at,answers")
        .in("exam_id", exams.map(e => e.id));

      const hist = exams.map(e => ({
        ...e,
        sub: (subs ?? []).find(s => s.exam_id === e.id) ?? null,
      }));
      setHistory(hist);

      const completed = hist.filter(h => h.sub?.score != null);
      const scores = completed.map(h => h.sub.score);
      setStats({
        total: hist.length,
        avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        best: scores.length ? Math.max(...scores) : null,
      });
      setLoading(false);
    })();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Noto Sans Hebrew',sans-serif" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: mobile ? "20px 16px" : "28px 24px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", maxWidth: 640, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>
          {firstName ? `שלום, ${firstName}` : "לוח הבקרה שלי"}
        </h1>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>בחן את עצמך ועקוב אחר ההתקדמות שלך</div>
      </div>

      <AccountSummary stats={[
        { label: "בחינות", value: stats.total },
        { label: "ממוצע", value: stats.avg ?? "—" },
        { label: "שיא", value: stats.best ?? "—" },
      ]} />

      {/* BIG CTA */}
      <button onClick={() => navigate("/self-test")}
        style={{ width: "100%", padding: "20px 24px", background: `linear-gradient(135deg, ${C.purple} 0%, #211F1A 100%)`, color: "white", border: "none", borderRadius: 18, fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 10, boxShadow: "0 6px 24px rgba(43,41,37,0.20)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Rocket size={26} strokeWidth={1.75} />
        <div style={{ textAlign: "right" }}>
          <div>בחן את עצמי עכשיו</div>
          <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>העלה חומר לימוד וקבל בחינה מיד</div>
        </div>
      </button>

      {/* Past exams CTA */}
      <button onClick={() => navigate("/past-exams")}
        style={{ width: "100%", padding: "14px 24px", background: `linear-gradient(135deg, ${C.amber} 0%, #6b3d08 100%)`, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <FolderOpen size={22} strokeWidth={1.75} />
        <div style={{ textAlign: "right" }}>
          <div>מבחני עבר</div>
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.85, marginTop: 1 }}>נתח מבחנים קודמים ·חזה נושאים · צור מבחן בסגנון</div>
        </div>
      </button>

      {/* Stats */}
      {stats.total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "בחינות", value: stats.total,        Icon: ClipboardList, color: C.purple, bg: C.purpleLight },
            { label: "ממוצע",  value: stats.avg ?? "—",   Icon: BarChart3,     color: C.teal,   bg: C.tealLight  },
            { label: "שיא",    value: stats.best ?? "—",  Icon: Trophy,        color: C.amber,  bg: C.amberLight },
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

      {/* Score trend (simple) */}
      {history.filter(h => h.sub?.score != null).length >= 2 && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📈 מגמת ציונים</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
            {history.filter(h => h.sub?.score != null).slice(0, 8).reverse().map((h, i) => {
              const pct = h.sub.score;
              const color = pct >= 85 ? C.teal : pct >= 60 ? C.amber : C.red;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{pct}</div>
                  <div style={{ width: "100%", height: `${(pct / 100) * 44}px`, background: color, borderRadius: 4, opacity: 0.85, minHeight: 4 }} />
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: "center" }}>הבחינות האחרונות (מהישנה לחדשה)</div>
        </div>
      )}

      {/* History */}
      {history.length > 0 ? (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
            📚 הבחינות שלי ({history.length})
          </div>
          {history.map(h => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {new Date(h.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
                  {h.subject && ` · ${h.subject}`}
                </div>
              </div>
              {h.sub?.score != null
                ? <ScoreBadge score={h.sub.score} />
                : <span style={{ fontSize: 11, color: C.amber, background: C.amberLight, borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>לא הושלם</span>
              }
              <button onClick={() => navigate(`/exam/${h.access_code}?selftest=1&name=${encodeURIComponent(profile?.full_name || "")}`)}
                style={{ padding: "6px 12px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                {h.sub?.score != null ? "🔁 שוב" : "▶ התחל"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <FolderOpen size={40} color={C.purpleMid} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>עדיין אין בחינות</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>לחץ על "בחן את עצמי" כדי להתחיל</div>
          <button onClick={() => navigate("/self-test")}
            style={{ padding: "11px 28px", background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Rocket size={16} strokeWidth={1.75} /> בחן את עצמי
          </button>
        </div>
      )}
    </div>
  );
}
