import { useAuth } from "./App";

const C = {
  ink: "#37352F", inkSoft: "#F4F2EC", muted: "#6B655C", text: "#2B2925",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
  accent: "#C2683D", accentSoft: "#F3E5DB",
  teal: "#4F6F52", amber: "#9A7B3F",
};

const ROLE_LABELS = {
  school_teacher: "מורה בבית ספר", private_tutor: "מורה פרטי", company: "חברה / ארגון",
  parent: "הורה", student: "סטודנט / תלמיד", other: "אחר",
};
const PLAN_LABELS = { free: "חינם", teacher: "מורה", pro: "פרו" };
const PLAN_BG     = { free: "#F4F2EC", teacher: "#F3EBD9", pro: "#37352F" };
const PLAN_FG     = { free: "#6B655C", teacher: "#9A7B3F", pro: "#ffffff" };

/**
 * Personal "my account" card — shows the logged-in user who they are
 * (name, email, role, plan, member-since). Macro/identity only; data is
 * the user's own (RLS-scoped). Optional `stats` prop for a quick recap row.
 */
export default function AccountSummary({ stats }) {
  const { user, profile } = useAuth();
  if (!user) return null;

  const name  = profile?.full_name || (user.email || "").split("@")[0];
  const email = profile?.email || user.email || "";
  const plan  = profile?.plan || "free";
  const role  = profile?.school_type;
  const initial = (name || "?").trim().charAt(0);
  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("he-IL", { month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 18, marginBottom: 20, fontFamily: "'Assistant',system-ui,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {/* Avatar */}
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.accentSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
          {initial}
        </div>
        {/* Identity */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{name}</div>
          <div style={{ fontSize: 12, color: C.muted, direction: "ltr", textAlign: "right" }}>{email}</div>
        </div>
        {/* Badges */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {role && ROLE_LABELS[role] && (
            <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 12px" }}>
              {ROLE_LABELS[role]}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: PLAN_FG[plan] ?? C.muted, background: PLAN_BG[plan] ?? C.bg, borderRadius: 20, padding: "4px 12px" }}>
            מסלול {PLAN_LABELS[plan] ?? plan}
          </span>
        </div>
      </div>

      {(joined || stats?.length) && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          {joined && (
            <div style={{ fontSize: 12, color: C.muted }}>חבר/ה מאז <strong style={{ color: C.text }}>{joined}</strong></div>
          )}
          {(stats ?? []).map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: C.muted }}>
              {s.label}: <strong style={{ color: C.text }}>{s.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
