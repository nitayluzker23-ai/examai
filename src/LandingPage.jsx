import { useNavigate } from "react-router-dom";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleDark: "#3C3489",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(83,74,183,0.12)", bg: "#f8f7ff", white: "#ffffff",
};

const STEPS = [
  { n: "1", icon: "📄", title: "מעלים חומר לימוד", desc: "PDF, מצגת, סיכום — מעלים את הקובץ ומקבלים שאלות תוך שניות" },
  { n: "2", icon: "✏️", title: "עורכים ומשכללים",  desc: "עורכים כל שאלה, מוחקים, מוסיפים ידנית — השאלות שלכם" },
  { n: "3", icon: "🚀", title: "שולחים לתלמידים",  desc: "קוד גישה קצר, ללא הרשמה — התלמיד מזין ומתחיל מיד" },
];

const FEATURES = [
  { icon: "🤖", title: "AI חכם מהחומר שלכם",       desc: "הAI מייצר שאלות רב-ברירה מהטקסט שלכם — כולל הסברים לכל תשובה" },
  { icon: "⏱",  title: "שלושה מצבי מבחן",           desc: "זמן חופשי, שעון לכל שאלה, או מבחן מחולק לפרקים עם הפסקות" },
  { icon: "📊", title: "ניתוח שגיאות בזמן אמת",     desc: "ראו מי ענה, מה הציונים, ואיזה נושאים הכי קשים לכיתה" },
  { icon: "🔁", title: "מבחן חזרה אוטומטי",         desc: "הAI בונה מבחן חזרה על הנושאים שבהם הכיתה טעתה הכי הרבה" },
  { icon: "🖨",  title: "הדפסה בלחיצה",              desc: "שאלון להדפסה + מפתח תשובות + דוח כיתתי — הכל מוכן" },
  { icon: "🔒", title: "פשוט ובטוח",                desc: "התלמיד מזין קוד בלבד, ללא הרשמה. הנתונים שלכם מאובטחים" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl", color: C.text, background: C.white }}>

      {/* ── NAVBAR ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.purple, letterSpacing: -0.5 }}>
            Exam<span style={{ color: C.teal }}>AI</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => navigate("/login")}
              style={{ padding: "8px 18px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
              כניסה
            </button>
            <button onClick={() => navigate("/login?signup=1")}
              style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: C.purple, color: "white", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              התחל בחינם
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg, #f0efff 0%, ${C.bg} 60%, #e8f5f0 100%)`, padding: "80px 24px 72px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: C.purpleLight, color: C.purple, fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 20, marginBottom: 22, border: `1px solid ${C.border}` }}>
            ✦ מערכת בחינות חכמה למורים
          </div>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px", color: C.text }}>
            מהחומר שלכם<br />
            <span style={{ color: C.purple }}>לבחינה מוכנה</span> — בדקות
          </h1>
          <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: C.muted, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 36px" }}>
            מעלים PDF או סיכום, הAI בונה שאלות, אתם עורכים ושולחים לתלמידים.
            בלי הרשמות, בלי סיבוכים.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/login?signup=1")}
              style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: C.purple, color: "white", fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(83,74,183,0.35)" }}>
              התחל בחינם ←
            </button>
            <button onClick={() => document.getElementById("how").scrollIntoView({ behavior: "smooth" })}
              style={{ padding: "14px 28px", borderRadius: 14, border: `1.5px solid ${C.border}`, background: "white", color: C.text, fontSize: 16, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
              איך זה עובד?
            </button>
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: C.muted }}>
            ✓ ללא כרטיס אשראי &nbsp;·&nbsp; ✓ ניסיון חינמי &nbsp;·&nbsp; ✓ בעברית מלאה
          </div>
        </div>
      </section>

      {/* ── MOCK SCREEN ── */}
      <section style={{ background: C.bg, padding: "0 24px 64px", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 8px 48px rgba(83,74,183,0.10)", overflow: "hidden" }}>
          {/* fake browser bar */}
          <div style={{ background: "#f1f0f7", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#FF5F57","#FFBD2E","#28CA41"].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />)}
            </div>
            <div style={{ flex: 1, background: "white", borderRadius: 8, padding: "4px 12px", fontSize: 12, color: C.muted, border: `1px solid ${C.border}` }}>
              examai-self.vercel.app
            </div>
          </div>
          {/* fake UI */}
          <div style={{ padding: 24, direction: "rtl" }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>שאלות במבחן (5)</div>
            {[
              "מהו התהליך שבו צמחים הופכים אור לאנרגיה?",
              "אילו פיגמנטים קיימים בעלי הצמחים?",
              "מה הם התוצרים של פוטוסינתזה?",
            ].map((q, i) => (
              <div key={i} style={{ background: i === 1 ? C.purpleLight : C.bg, border: `1px solid ${i === 1 ? C.purple : C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: C.muted, minWidth: 20 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: C.text }}>{q}</span>
                <span style={{ fontSize: 11, background: i === 1 ? C.purple : "transparent", color: i === 1 ? "white" : C.muted, padding: "2px 8px", borderRadius: 6 }}>{i === 1 ? "✏️ עריכה" : "▼"}</span>
              </div>
            ))}
            {/* edit mode mock */}
            <div style={{ background: C.white, border: `1.5px solid ${C.purple}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>עריכת שאלה 2</div>
              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text, marginBottom: 10 }}>
                אילו פיגמנטים קיימים בעלי הצמחים?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[["כלורופיל a ו-b", true], ["קרוטנואידים", false], ["אנתוציאנינים", false], ["כולם נכונים", false]].map(([opt, correct], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, background: correct ? C.tealLight : "transparent", border: `1px solid ${correct ? "#9FD9C7" : C.border}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: correct ? C.teal : C.muted, minWidth: 18 }}>{correct ? "✓" : `${i + 1}.`}</span>
                    <span style={{ fontSize: 13 }}>{opt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <div style={{ padding: "7px 18px", background: C.purple, color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ שמור שינויים</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: "64px 24px", background: C.white }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 10 }}>איך זה עובד?</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, margin: 0 }}>שלושה צעדים פשוטים</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 18, padding: 28, position: "relative", border: `1px solid ${C.border}` }}>
                <div style={{ position: "absolute", top: 20, left: 20, width: 28, height: 28, borderRadius: "50%", background: C.purple, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: 36, marginBottom: 14 }}>{s.icon}</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "64px 24px", background: C.bg }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, margin: 0 }}>כל מה שמורה צריך</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 16, padding: 24, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 7 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "72px 24px", background: `linear-gradient(135deg, ${C.purple} 0%, #3C3489 100%)`, textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, color: "white", margin: "0 0 16px", lineHeight: 1.2 }}>
            מוכן לבנות בחינה בדקות?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", marginBottom: 32, lineHeight: 1.6 }}>
            הצטרף למורים שכבר חוסכים שעות בהכנת בחינות
          </p>
          <button onClick={() => navigate("/login?signup=1")}
            style={{ padding: "15px 40px", borderRadius: 14, border: "none", background: "white", color: C.purple, fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
            התחל בחינם ←
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.text, padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          © 2025 ExamAI · כל הזכויות שמורות
        </div>
      </footer>
    </div>
  );
}
