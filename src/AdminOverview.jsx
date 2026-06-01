import { useState, useEffect } from "react";
import { Users, ClipboardList, FileQuestion, PenLine, GraduationCap, Gauge, TrendingUp, FolderOpen, Inbox } from "lucide-react";
import { supabase } from "./App";

const C = {
  ink: "#37352F", inkSoft: "#F4F2EC", muted: "#6B655C", text: "#2B2925",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
  accent: "#C2683D", accentSoft: "#F3E5DB",
  teal: "#4F6F52", tealSoft: "#E8EDE6", amber: "#9A7B3F", amberSoft: "#F3EBD9",
};

const ROLE_LABELS = {
  school_teacher: "מורה בבי״ס", private_tutor: "מורה פרטי", company: "חברה",
  parent: "הורה", student: "סטודנט", other: "אחר", unknown: "לא הוגדר",
};
const PLAN_LABELS = { free: "חינם", teacher: "מורה", pro: "פרו" };
const PLAN_COLORS = { free: "#9B958A", teacher: "#9A7B3F", pro: "#37352F" };

export default function AdminOverview() {
  const [data, setData]   = useState(null);
  const [err,  setErr]    = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_macro_stats");
      if (error) setErr(error.message); else setData(data);
    })();
  }, []);

  if (err)  return <div style={{ background: "#F3E2DD", color: "#A6493B", borderRadius: 12, padding: "12px 16px", fontSize: 13, marginBottom: 20 }}>שגיאה בטעינת נתוני מאקרו: {err}</div>;
  if (!data) return (
    <div style={{ padding: 30, textAlign: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.inkSoft}`, borderTopColor: C.ink, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const t = data.totals || {};
  const l30 = data.last30 || {};
  const l7 = data.last7 || {};
  const daily = data.daily || [];
  const maxDaily = Math.max(1, ...daily.map(d => Math.max(d.exams, d.submissions)));

  const kpis = [
    { label: "משתמשים", value: t.users ?? 0,       Icon: Users,        color: C.ink,   bg: C.inkSoft },
    { label: "מבחנים",  value: t.exams ?? 0,       Icon: ClipboardList, color: C.accent, bg: C.accentSoft },
    { label: "שאלות",   value: t.questions ?? 0,   Icon: FileQuestion, color: C.teal,  bg: C.tealSoft },
    { label: "הגשות",   value: t.submissions ?? 0, Icon: PenLine,      color: C.amber, bg: C.amberSoft },
    { label: "תלמידים", value: t.students ?? 0,    Icon: GraduationCap, color: C.ink,   bg: C.inkSoft },
    { label: "ציון ממוצע", value: t.avg_score != null ? `${t.avg_score}` : "—", Icon: Gauge, color: C.teal, bg: C.tealSoft },
  ];

  const planEntries = Object.entries(data.plans || {});
  const totalPlans = planEntries.reduce((a, [, c]) => a + c, 0) || 1;
  const roleEntries = Object.entries(data.roles || {}).sort((a, b) => b[1] - a[1]);
  const totalRoles = roleEntries.reduce((a, [, c]) => a + c, 0) || 1;

  return (
    <div style={{ marginBottom: 28, fontFamily: "'Assistant',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 14, padding: "16px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <k.Icon size={19} color={k.color} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>{Number(k.value).toLocaleString?.() ?? k.value}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{k.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last 30 days strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "משתמשים חדשים (30 יום)", value: l30.new_users ?? 0 },
          { label: "מבחנים שנוצרו (30 יום)", value: l30.exams ?? 0 },
          { label: "הגשות (30 יום)", value: l30.submissions ?? 0 },
        ].map((s, i) => (
          <div key={i} style={{ background: C.accentSoft, borderRadius: 12, padding: "12px 14px", border: `1px solid rgba(194,104,61,0.18)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <TrendingUp size={14} color={C.accent} />
              <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>+{s.value}</span>
            </div>
            <div style={{ fontSize: 11, color: "#9A4D29" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Activity chart (14 days) */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>פעילות ב-14 הימים האחרונים</div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.muted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.accent }} /> מבחנים</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.teal }} /> הגשות</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
          {daily.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 72, width: "100%", justifyContent: "center" }}>
                <div title={`${d.exams} מבחנים`} style={{ width: "42%", maxWidth: 14, height: `${(d.exams / maxDaily) * 100}%`, minHeight: d.exams ? 3 : 0, background: C.accent, borderRadius: "3px 3px 0 0" }} />
                <div title={`${d.submissions} הגשות`} style={{ width: "42%", maxWidth: 14, height: `${(d.submissions / maxDaily) * 100}%`, minHeight: d.submissions ? 3 : 0, background: C.teal, borderRadius: "3px 3px 0 0" }} />
              </div>
              <span style={{ fontSize: 9, color: C.muted }}>{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan + Role distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>התפלגות מנויים</div>
          {planEntries.map(([plan, count]) => (
            <div key={plan} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: C.text }}>{PLAN_LABELS[plan] ?? plan}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>{count}</span>
              </div>
              <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(count / totalPlans) * 100}%`, background: PLAN_COLORS[plan] ?? C.ink, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>התפלגות לפי תפקיד</div>
          {roleEntries.map(([role, count]) => (
            <div key={role} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: C.text }}>{ROLE_LABELS[role] ?? role}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>{count}</span>
              </div>
              <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(count / totalRoles) * 100}%`, background: C.accent, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Small footers */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.text }}>
          <Inbox size={16} color={C.amber} /> {data.pending_requests ?? 0} בקשות פיצ'ר ממתינות
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.text }}>
          <FolderOpen size={16} color={C.accent} /> {data.prep_approved ?? 0} מיילים מאושרים להכנה
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.text }}>
          <ClipboardList size={16} color={C.teal} /> {t.self_tests ?? 0} מבחני "בחן את עצמי"
        </div>
      </div>
    </div>
  );
}
