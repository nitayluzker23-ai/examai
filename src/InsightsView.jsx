import { useState, useEffect, useRef } from "react";

// ── Demo Data ─────────────────────────────────────────────
const WORKSPACES = [
  { id: "ws1", name: "בית ספר אורט תל אביב" },
  { id: "ws2", name: "עמותת ידידים" },
  { id: "ws3", name: "למידה עצמית" },
];

const EXAMS = {
  ws1: [
    { id: "e1", title: "מבחן סוף שנה — ביולוגיה", subject: "ביולוגיה", class: "י׳2", status: "published", created_at: "2025-06-10" },
    { id: "e2", title: "חזרה לפרק 3 — גנטיקה",    subject: "ביולוגיה", class: "י׳2", status: "published", created_at: "2025-06-08" },
  ],
  ws2: [
    { id: "e3", title: "הכשרת בטיחות — מחזור יוני", subject: "בטיחות", class: "עובדים חדשים", status: "published", created_at: "2025-06-09" },
  ],
  ws3: [
    { id: "e4", title: "פסיכומטרי — מתמטיקה", subject: "מתמטיקה", class: "עצמאי", status: "draft", created_at: "2025-06-11" },
  ],
};

const TOPICS = ["תא וביולוגיה מולקולרית", "גנטיקה", "אבולוציה", "אקולוגיה"];

const makeStudents = () => [
  { id: 1,  name: "יעל כהן",      status: "done",    score: 92, q: 20, tabs: 0, time: "14:23" },
  { id: 2,  name: "אבי לוי",      status: "done",    score: 78, q: 20, tabs: 1, time: "14:31" },
  { id: 3,  name: "מיכל ברק",     status: "active",  score: null, q: 14, tabs: 0, time: null },
  { id: 4,  name: "דניאל שפירא",  status: "active",  score: null, q: 9,  tabs: 4, time: null },
  { id: 5,  name: "רונית גולן",   status: "done",    score: 55, q: 20, tabs: 2, time: "14:28" },
  { id: 6,  name: "עמית פרץ",     status: "active",  score: null, q: 17, tabs: 0, time: null },
  { id: 7,  name: "שירה אזולאי",  status: "done",    score: 88, q: 20, tabs: 0, time: "14:19" },
  { id: 8,  name: "נועם ביטון",   status: "waiting", score: null, q: 0,  tabs: 0, time: null },
  { id: 9,  name: "תמר עמר",      status: "done",    score: 71, q: 20, tabs: 1, time: "14:35" },
  { id: 10, name: "יוסי מזרחי",   status: "waiting", score: null, q: 0,  tabs: 0, time: null },
];

const TOPIC_SCORES = [
  { topic: "תא וביולוגיה", pct: 82, questions: 8 },
  { topic: "גנטיקה",       pct: 54, questions: 6 },
  { topic: "אבולוציה",     pct: 91, questions: 4 },
  { topic: "אקולוגיה",     pct: 63, questions: 2 },
];

const TOPIC_DETAIL = {
  "גנטיקה": [
    { q: "מהו עיקרון הדומיננטיות של מנדל?", pct: 45, wrong: "כל האללים שווים (40%)" },
    { q: "איזה סוג הצלבה מייצר יחס 3:1?", pct: 62, wrong: "הצלבה חד-גנית (25%)" },
  ],
  "אקולוגיה": [
    { q: "מהי מחזוריות הפחמן?", pct: 58, wrong: "מחזוריות המים (32%)" },
  ],
};

// ── Colors ────────────────────────────────────────────────
const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleDark: "#3C3489",
  teal: "#0F6E56",   tealLight: "#E1F5EE",
  amber: "#854F0B",  amberLight: "#FAEEDA",
  red:   "#A32D2D",  redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

// ── CSV export ────────────────────────────────────────────
function exportCSV(students, examTitle) {
  const rows = [["שם", "סטטוס", "ציון", "שאלה נוכחית", "יציאות טאב", "שעת סיום"]];
  students.forEach(s => rows.push([s.name, s.status === "done" ? "סיים" : s.status === "active" ? "פעיל" : "ממתין", s.score ?? "", s.q, s.tabs, s.time ?? ""]));
  const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${examTitle}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
export default function InsightsView() {
  const [wsId,      setWsId]      = useState("ws1");
  const [examId,    setExamId]    = useState("e1");
  const [students,  setStudents]  = useState(makeStudents());
  const [tab,       setTab]       = useState("live");      // live | topics | students
  const [selTopic,  setSelTopic]  = useState(null);
  const [wsOpen,    setWsOpen]    = useState(false);
  const [tick,      setTick]      = useState(0);
  const intervalRef = useRef(null);

  const ws   = WORKSPACES.find(w => w.id === wsId);
  const exam = EXAMS[wsId]?.find(e => e.id === examId);

  // simulate live updates
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setStudents(prev => {
        const next = [...prev];
        const active = next.filter(s => s.status === "active");
        if (active.length) {
          const s = active[Math.floor(Math.random() * active.length)];
          const idx = next.findIndex(x => x.id === s.id);
          if (next[idx].q < 20) {
            next[idx] = { ...next[idx], q: next[idx].q + 1 };
            if (next[idx].q === 20) {
              next[idx] = { ...next[idx], status: "done", score: 60 + Math.floor(Math.random() * 36), time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) };
            }
          }
        }
        const waiting = next.filter(s => s.status === "waiting");
        if (waiting.length && Math.random() > 0.75) {
          const s = waiting[0];
          const idx = next.findIndex(x => x.id === s.id);
          next[idx] = { ...next[idx], status: "active", q: 1 };
        }
        return next;
      });
      setTick(t => t + 1);
    }, 2800);
    return () => clearInterval(intervalRef.current);
  }, []);

  // metrics
  const done    = students.filter(s => s.status === "done");
  const active  = students.filter(s => s.status === "active");
  const waiting = students.filter(s => s.status === "waiting");
  const alerts  = students.filter(s => s.tabs >= 3);
  const avgScore = done.length ? Math.round(done.reduce((a, s) => a + s.score, 0) / done.length) : null;
  const weakTopic = [...TOPIC_SCORES].sort((a, b) => a.pct - b.pct)[0];

  const switchWs = (id) => {
    setWsId(id);
    setExamId(EXAMS[id]?.[0]?.id ?? null);
    setWsOpen(false);
    setStudents(makeStudents());
    setSelTopic(null);
    setTab("live");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>

      {/* ── Top bar ── */}
      <div style={{ background: C.purple, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#CECBF6", marginBottom: 2 }}>מרחב עבודה</div>
          <div onClick={() => setWsOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#EEEDFE" }}>{ws?.name}</span>
            <span style={{ color: "#AFA9EC", fontSize: 12 }}>{wsOpen ? "▲" : "▼"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <LiveDot active={active.length > 0} />
          <button onClick={() => exportCSV(students, exam?.title ?? "מבחן")}
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ייצוא CSV
          </button>
        </div>

        {/* Workspace dropdown */}
        {wsOpen && (
          <div style={{ position: "absolute", top: "100%", right: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 220, overflow: "hidden" }}>
            {WORKSPACES.map(w => (
              <div key={w.id} onClick={() => switchWs(w.id)}
                style={{ padding: "12px 16px", cursor: "pointer", background: w.id === wsId ? C.purpleLight : "transparent", fontSize: 13, color: w.id === wsId ? C.purple : C.text, fontWeight: w.id === wsId ? 600 : 400, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                {w.id === wsId && <span style={{ color: C.purple, fontSize: 10 }}>●</span>}
                {w.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Exam selector ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", gap: 8, overflowX: "auto" }}>
        {(EXAMS[wsId] ?? []).map(e => (
          <button key={e.id} onClick={() => { setExamId(e.id); setStudents(makeStudents()); setSelTopic(null); }}
            style={{ whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 20, border: `1px solid ${e.id === examId ? C.purple : C.border}`, background: e.id === examId ? C.purpleLight : "transparent", color: e.id === examId ? C.purple : C.muted, fontSize: 12, fontWeight: e.id === examId ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
            {e.title}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 16px 32px", maxWidth: 520, margin: "0 auto" }}>

        {/* ── Metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
          <MetricCard label="השלמה" value={`${done.length}/${students.length}`} sub={`${Math.round((done.length/students.length)*100)}% סיימו`} color={C.purple} bg={C.purpleLight} />
          <MetricCard label="ציון ממוצע" value={avgScore !== null ? `${avgScore}%` : "—"} sub={done.length ? `${done.length} ציונים` : "ממתין לנתונים"} color={avgScore >= 70 ? C.teal : avgScore >= 55 ? C.amber : C.red} bg={avgScore >= 70 ? C.tealLight : avgScore >= 55 ? C.amberLight : C.redLight} />
          <MetricCard label="נושא חלש" value={weakTopic.topic.split(" ")[0]} sub={`${weakTopic.pct}% הצלחה ממוצעת`} color={C.red} bg={C.redLight} />
          <MetricCard label="התראות" value={alerts.length || "—"} sub={alerts.length ? "יציאות טאב מרובות" : "הכל תקין"} color={alerts.length ? C.red : C.teal} bg={alerts.length ? C.redLight : C.tealLight} />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, gap: 3, marginBottom: 14 }}>
          {[["live","מעקב חי"],["topics","ניתוח נושאים"],["students","כל התלמידים"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", background: tab === id ? C.purple : "transparent", color: tab === id ? "white" : C.muted, fontSize: 12, fontWeight: tab === id ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Live monitor ── */}
        {tab === "live" && (
          <div>
            {alerts.length > 0 && (
              <div style={{ background: C.redLight, border: `1px solid #F09595`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C.red }}>
                <strong>התראה:</strong> {alerts.map(s => s.name).join(", ")} — יצאו מהמסך יותר מ-3 פעמים
              </div>
            )}
            <SectionLabel>פעיל כרגע ({active.length})</SectionLabel>
            {active.length === 0 && <EmptyState text="אין תלמידים פעילים כרגע" />}
            {active.map(s => <StudentRow key={s.id} s={s} />)}
            <SectionLabel style={{ marginTop: 12 }}>סיימו ({done.length})</SectionLabel>
            {done.length === 0 && <EmptyState text="אף תלמיד עוד לא סיים" />}
            {done.map(s => <StudentRow key={s.id} s={s} />)}
            {waiting.length > 0 && <>
              <SectionLabel style={{ marginTop: 12 }}>טרם נכנסו ({waiting.length})</SectionLabel>
              {waiting.map(s => <StudentRow key={s.id} s={s} />)}
            </>}
          </div>
        )}

        {/* ── Tab: Topic analysis ── */}
        {tab === "topics" && (
          <div>
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>הצלחה לפי נושא</div>
              {TOPIC_SCORES.map(t => (
                <TopicBar key={t.topic} t={t} selected={selTopic === t.topic} onClick={() => setSelTopic(selTopic === t.topic ? null : t.topic)} />
              ))}
            </div>

            {selTopic && TOPIC_DETAIL[selTopic] && (
              <div style={{ background: C.white, borderRadius: 16, border: `1px solid #F09595`, padding: 20, animation: "fadeIn 0.25s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.red }}>נושא קשה: {selTopic}</div>
                  <button onClick={() => setSelTopic(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 18 }}>✕</button>
                </div>
                {TOPIC_DETAIL[selTopic].map((q, i) => (
                  <div key={i} style={{ background: C.redLight, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 4 }}>{q.pct}% הצלחה</div>
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{q.q}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>טעות נפוצה: {q.wrong}</div>
                  </div>
                ))}
                <div style={{ background: C.purpleLight, borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.purpleDark, fontWeight: 600, marginBottom: 3 }}>המלצת AI</div>
                  <div style={{ fontSize: 12, color: C.purpleDark, lineHeight: 1.6 }}>
                    נראה שהתלמידים מתקשים בהבנת {selTopic}. מומלץ לבצע רענון קצר על השאלות שצוינו למעלה לפני המבחן הבא, ולשלוח חומר חזרה ממוקד.
                  </div>
                </div>
              </div>
            )}

            {selTopic && !TOPIC_DETAIL[selTopic] && (
              <div style={{ background: C.tealLight, borderRadius: 12, padding: 14, fontSize: 12, color: C.teal }}>
                נושא זה מראה ביצועים טובים ({TOPIC_SCORES.find(t => t.topic === selTopic)?.pct}%). אין המלצות מיוחדות.
              </div>
            )}
          </div>
        )}

        {/* ── Tab: All students ── */}
        {tab === "students" && (
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>כל התלמידים</span>
              <button onClick={() => exportCSV(students, exam?.title ?? "מבחן")}
                style={{ background: C.purpleLight, border: "none", color: C.purple, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                ייצוא Excel ↓
              </button>
            </div>
            {students.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < students.length - 1 ? `1px solid ${C.border}` : "none", background: s.tabs >= 3 ? "#fff8f8" : "white" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: C.purple, flexShrink: 0 }}>
                  {s.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {s.status === "done" ? `סיים ב-${s.time}` : s.status === "active" ? `שאלה ${s.q}/20` : "טרם נכנס"}
                    {s.tabs > 0 && ` · ${s.tabs} יציאות טאב`}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  {s.status === "done"
                    ? <span style={{ fontSize: 15, fontWeight: 700, color: s.score >= 70 ? C.teal : s.score >= 55 ? C.amber : C.red }}>{s.score}%</span>
                    : <StatusBadge s={s} />
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function MetricCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color, opacity: 0.75, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function TopicBar({ t, selected, onClick }) {
  const color = t.pct >= 75 ? C.teal : t.pct >= 55 ? C.amber : C.red;
  const bg    = t.pct >= 75 ? C.tealLight : t.pct >= 55 ? C.amberLight : C.redLight;
  return (
    <div onClick={onClick} style={{ marginBottom: 12, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `1px solid ${selected ? color : "transparent"}`, background: selected ? bg + "60" : "transparent", transition: "all 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.text, fontWeight: selected ? 600 : 400 }}>{t.topic}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{t.pct}%</span>
      </div>
      <div style={{ height: 8, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${t.pct}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      {t.pct < 65 && <div style={{ fontSize: 11, color, marginTop: 5 }}>לחץ לפירוט ↓</div>}
    </div>
  );
}

function StudentRow({ s }) {
  const isAlert = s.tabs >= 3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isAlert ? "#fff5f5" : C.white, border: `1px solid ${isAlert ? "#F09595" : C.border}`, borderRadius: 12, marginBottom: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.status === "done" ? C.teal : s.status === "active" ? "#F59E0B" : C.border, flexShrink: 0, animation: s.status === "active" ? "pulse 2s infinite" : "none" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{s.name}</div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {s.status === "done" && `סיים · ${s.time}`}
          {s.status === "active" && `שאלה ${s.q} מתוך 20`}
          {s.status === "waiting" && "טרם נכנס"}
          {s.tabs > 0 && <span style={{ color: s.tabs >= 3 ? C.red : C.amber }}> · {s.tabs} יציאות טאב</span>}
        </div>
      </div>
      <div>
        {s.status === "done" && (
          <span style={{ fontSize: 15, fontWeight: 700, color: s.score >= 70 ? C.teal : s.score >= 55 ? C.amber : C.red }}>{s.score}%</span>
        )}
        {s.status === "active" && (
          <div style={{ background: C.amberLight, borderRadius: 8, padding: "3px 8px" }}>
            <div style={{ height: 4, width: 60, background: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((s.q/20)*100)}%`, background: C.amber, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </div>
        )}
        {s.status === "waiting" && <span style={{ fontSize: 11, color: C.muted }}>ממתין</span>}
      </div>
    </div>
  );
}

function StatusBadge({ s }) {
  const map = { active: [C.amber, C.amberLight, "פעיל"], waiting: [C.muted, C.bg, "ממתין"] };
  const [color, bg, label] = map[s.status] ?? [C.muted, C.bg, s.status];
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, border: `1px solid ${color}30` }}>{label}</span>;
}

function LiveDot({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#4ade80" : C.muted, animation: active ? "pulse 2s infinite" : "none" }} />
      <span style={{ fontSize: 11, color: active ? "#86efac" : "#9CA3AF" }}>{active ? "שידור חי" : "אין פעילות"}</span>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginBottom: 8, ...style }}>{children}</div>;
}

function EmptyState({ text }) {
  return <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13, color: C.muted }}>{text}</div>;
}

const C_USED = { purple: "#534AB7", purpleLight: "#EEEDFE", purpleDark: "#3C3489", teal: "#0F6E56", tealLight: "#E1F5EE", amber: "#854F0B", amberLight: "#FAEEDA", red: "#A32D2D", redLight: "#FCEBEB", text: "#1a1a2e", muted: "#6b7280", border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff" };
