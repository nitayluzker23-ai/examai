import { useState, useEffect } from "react";
import { supabase, useAuth } from "./App";
import { Navigate } from "react-router-dom";
import { PLANS } from "./planConfig";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

const FEATURE_LABELS = {
  ai_text:        { label: "AI מטקסט/PDF",   icon: "📄" },
  ai_image:       { label: "AI מתמונה",       icon: "🖼" },
  past_exams:     { label: "מבחנים קודמים",  icon: "📚" },
  pdf_export:     { label: "ייצוא PDF",       icon: "🖨" },
  exam_created:   { label: "מבחן נוצר",       icon: "➕" },
  exam_published: { label: "מבחן פורסם",      icon: "✅" },
};

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [teachers,        setTeachers]        = useState([]);
  const [features,        setFeatures]        = useState([]);
  const [featureRequests, setFeatureRequests] = useState([]);
  const [totals,          setTotals]          = useState({ teachers: 0, exams: 0, questions: 0, submissions: 0 });
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [sortBy,          setSortBy]          = useState("exam_count");

  useEffect(() => { if (profile?.is_admin) load(); }, [profile]);

  async function load() {
    setLoading(true);
    const [{ data: teachers }, { data: features }, { data: requests }] = await Promise.all([
      supabase.from("admin_teacher_stats").select("*").order(sortBy, { ascending: false }),
      supabase.from("admin_feature_stats").select("*").order("total_uses", { ascending: false }),
      supabase.from("feature_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setFeatureRequests(requests ?? []);

    const t = teachers ?? [];
    setTeachers(t);
    setFeatures(features ?? []);
    setTotals({
      teachers:    t.filter(x => !x.is_admin).length,
      exams:       t.reduce((a, x) => a + Number(x.exam_count),       0),
      questions:   t.reduce((a, x) => a + Number(x.question_count),   0),
      submissions: t.reduce((a, x) => a + Number(x.submission_count), 0),
    });
    setLoading(false);
  }

  async function toggleAdmin(teacher) {
    await supabase.from("profiles").update({ is_admin: !teacher.is_admin }).eq("id", teacher.user_id);
    await load();
  }

  async function changePlan(teacher, plan) {
    await supabase.from("profiles").update({ plan }).eq("id", teacher.user_id);
    setTeachers(prev => prev.map(t => t.user_id === teacher.user_id ? { ...t, plan } : t));
  }

  if (authLoading) return <Spinner />;
  if (!user || !profile?.is_admin) return <Navigate to="/dashboard" replace />;

  const maxFeature = Math.max(...features.map(f => f.total_uses), 1);
  const filtered = teachers.filter(t =>
    !search || t.full_name?.includes(search) || t.email?.includes(search)
  );

  return (
    <div style={{ padding: "24px 20px", direction: "rtl", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.purple }}>🛡 לוח ניהול</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>נתוני מאקרו לכלל המשתמשים</div>
      </div>

      {/* Macro cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "מורים רשומים", value: totals.teachers, icon: "👩‍🏫", color: C.purple, bg: C.purpleLight },
          { label: "מבחנים נוצרו",  value: totals.exams,    icon: "📝", color: C.teal,   bg: C.tealLight },
          { label: "שאלות בבנק",    value: totals.questions, icon: "❓", color: C.amber,  bg: C.amberLight },
          { label: "הגשות תלמידים", value: totals.submissions, icon: "✍", color: C.red,   bg: C.redLight },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, borderRadius: 14, padding: "16px 18px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 24 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1.2, marginTop: 6 }}>{loading ? "…" : card.value.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: card.color, opacity: 0.8, marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

        {/* Feature usage */}
        <div style={{ flex: "0 0 260px" }}>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>שימוש בפיצ'רים</div>
            {loading ? <Spinner small /> : features.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "20px 0" }}>
                עדיין אין נתוני שימוש<br /><span style={{ fontSize: 11 }}>יצטבר לאחר שימוש בפלטפורמה</span>
              </div>
            ) : features.map(f => {
              const info = FEATURE_LABELS[f.feature] ?? { label: f.feature, icon: "⚙" };
              const pct = Math.round((f.total_uses / maxFeature) * 100);
              return (
                <div key={f.feature} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span>{info.icon} {info.label}</span>
                    <span style={{ color: C.muted }}>{f.total_uses} · {f.unique_users} מורים</span>
                  </div>
                  <div style={{ height: 6, background: "#f0f0f8", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: C.purple, borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Teachers table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1 }}>מורים</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש..."
                style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit", direction: "rtl", outline: "none", width: 160 }} />
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); }}
                style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none" }}>
                <option value="exam_count">מיון: מבחנים</option>
                <option value="question_count">מיון: שאלות</option>
                <option value="submission_count">מיון: הגשות</option>
                <option value="joined_at">מיון: הצטרפות</option>
              </select>
              <button onClick={load} style={{ fontSize: 12, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, cursor: "pointer", fontFamily: "inherit" }}>
                🔄 רענן
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {["שם", "אימייל", "תוכנית", "מבחנים", "שאלות", "הגשות", "הצטרף", ""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: C.muted, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center" }}><Spinner small /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 12 }}>אין תוצאות</td></tr>
                  ) : filtered.map((t, i) => (
                    <tr key={t.user_id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", background: t.is_admin ? C.purpleLight : "transparent" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                        {t.full_name ?? "—"}
                        {t.is_admin && <span style={{ fontSize: 10, background: C.purple, color: "white", borderRadius: 4, padding: "1px 5px", marginRight: 6 }}>ADMIN</span>}
                      </td>
                      <td style={{ padding: "10px 12px", color: C.muted, fontSize: 12 }}>{t.email ?? "—"}</td>
                      <td style={{ padding: "6px 12px" }}>
                        <select
                          value={t.plan ?? "free"}
                          onChange={e => changePlan(t, e.target.value)}
                          style={{ fontSize: 11, padding: "3px 7px", borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: "inherit", background: PLANS[t.plan ?? "free"]?.bg, color: PLANS[t.plan ?? "free"]?.color, fontWeight: 600, cursor: "pointer" }}>
                          {Object.entries(PLANS).map(([key, p]) => (
                            <option key={key} value={key}>{p.label}</option>
                          ))}
                        </select>
                      </td>
                      <Num v={t.exam_count} />
                      <Num v={t.question_count} />
                      <Num v={t.submission_count} />
                      <td style={{ padding: "10px 12px", color: C.muted, fontSize: 11, whiteSpace: "nowrap" }}>
                        {t.joined_at ? new Date(t.joined_at).toLocaleDateString("he-IL") : "—"}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <button onClick={() => toggleAdmin(t)}
                          title={t.is_admin ? "הסר הרשאת אדמין" : "הפוך לאדמין"}
                          style={{ fontSize: 11, padding: "3px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: "none", cursor: "pointer", fontFamily: "inherit", color: C.muted }}>
                          {t.is_admin ? "⬇ אדמין" : "⬆ אדמין"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Feature Requests ── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            📩 בקשות פיצ'ר מהעוזר AI
            {featureRequests.filter(r => r.status === "pending").length > 0 && (
              <span style={{ marginRight: 8, background: C.red, color: "white", borderRadius: 20, padding: "2px 9px", fontSize: 12 }}>
                {featureRequests.filter(r => r.status === "pending").length} חדשות
              </span>
            )}
          </div>
          {featureRequests.length === 0 ? (
            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
              אין בקשות עדיין
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {featureRequests.map(r => (
                <div key={r.id} style={{ background: C.white, borderRadius: 12, border: `1px solid ${r.status === "pending" ? C.amber : C.border}`, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{r.request}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {r.user_email} · {r.user_role} · {new Date(r.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {["pending","reviewed","done"].map(s => (
                      <button key={s} onClick={async () => {
                        await supabase.from("feature_requests").update({ status: s }).eq("id", r.id);
                        setFeatureRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: s } : x));
                      }}
                        style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: r.status === s ? (s === "done" ? C.tealLight : s === "reviewed" ? C.purpleLight : C.amberLight) : "transparent", color: r.status === s ? (s === "done" ? C.teal : s === "reviewed" ? C.purple : C.amber) : C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: r.status === s ? 700 : 400 }}>
                        {s === "pending" ? "ממתין" : s === "reviewed" ? "נבדק" : "בוצע"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Num({ v }) {
  return (
    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: Number(v) > 0 ? C.text : C.muted }}>
      {Number(v).toLocaleString()}
    </td>
  );
}

function Spinner({ small }) {
  const s = small ? 20 : 32;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: small ? 8 : 40 }}>
      <div style={{ width: s, height: s, border: `3px solid #EEEDFE`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
