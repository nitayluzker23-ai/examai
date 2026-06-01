import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleDark: "#211F1A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(43,41,37,0.08)", bg: "#FAF9F6", white: "#ffffff",
};

const STEPS = [
  { n: "1", icon: "📄", title: "מעלים חומר לימוד", desc: "PDF, מצגת, סיכום — מעלים את הקובץ ומקבלים שאלות תוך שניות" },
  { n: "2", icon: "✏️", title: "עורכים ומשכללים",  desc: "עורכים כל שאלה, מוחקים, מוסיפים ידנית — השאלות שלכם" },
  { n: "3", icon: "🚀", title: "שולחים לנבחנים",   desc: "קוד גישה קצר, ללא הרשמה — הנבחן מזין ומתחיל מיד" },
];

const FEATURES = [
  { icon: "🤖", title: "AI חכם מהחומר שלכם",     desc: "הAI מייצר שאלות רב-ברירה מהטקסט שלכם — כולל הסברים לכל תשובה" },
  { icon: "⏱",  title: "שלושה מצבי מבחן",         desc: "זמן חופשי, שעון לכל שאלה, או מבחן מחולק לפרקים עם הפסקות" },
  { icon: "📊", title: "ניתוח שגיאות בזמן אמת",   desc: "ראו מי ענה, מה הציונים, ואיזה נושאים הכי קשים לכיתה" },
  { icon: "🔁", title: "מבחן חזרה אוטומטי",       desc: "הAI בונה מבחן חזרה על הנושאים שבהם הנבחנים טעו הכי הרבה" },
  { icon: "🖨",  title: "הדפסה בלחיצה",            desc: "שאלון להדפסה + מפתח תשובות + דוח קבוצתי — הכל מוכן" },
  { icon: "🔒", title: "פשוט ובטוח",              desc: "הנבחן מזין קוד בלבד, ללא הרשמה. הנתונים שלכם מאובטחים" },
];

// ── Pricing plans (edit prices here) ──────────────────────
const PLANS = [
  {
    name: "חינם",
    price: "₪0",
    period: "לתמיד",
    desc: "להתנסות ולשימוש קל",
    features: ["3 מבחנים ביום", "יצירת שאלות מטקסט (AI)", "תלמיד אחד", "עד 3 עמודי חומר"],
    cta: "התחל בחינם",
    highlight: false,
  },
  {
    name: "מורה",
    price: "₪39",
    period: "לחודש",
    desc: "למורים ומורים פרטיים",
    features: ["5 מבחנים ביום", "עד 20 תלמידים", "ייצוא PDF + מפתח תשובות", "מבחן חזרה אוטומטי", "תזמון מבחנים", "עד 6 עמודי חומר"],
    cta: "התחל 14 ימי ניסיון",
    highlight: true,
  },
  {
    name: "פרו",
    price: "₪89",
    period: "לחודש",
    desc: "לשימוש מקצועי וארגונים",
    features: ["מבחנים ללא הגבלה", "תלמידים ללא הגבלה", "יצירה מתמונה", "ניתוח מבחני עבר", "מיתוג אישי (לוגו + צבעים)", "עוזר AI חכם", "חומר ללא הגבלה"],
    cta: "התחל עם פרו",
    highlight: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  return (
    <div style={{ fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", color: C.text, background: C.white }}>

      {/* ── NAVBAR ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.93)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: `0 ${mobile ? 16 : 24}px` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: mobile ? 18 : 20, fontWeight: 800, color: C.purple, letterSpacing: -0.5 }}>
            Exam<span style={{ color: C.teal }}>AI</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!mobile && (
              <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
                style={{ padding: "7px 12px", borderRadius: 10, border: "none", background: "transparent", color: C.text, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                מחירים
              </button>
            )}
            {!mobile && (
              <button onClick={() => navigate("/login")}
                style={{ padding: "7px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                כניסה
              </button>
            )}
            <button onClick={() => navigate("/login?signup=1")}
              style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: C.purple, color: "white", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              {mobile ? "התחל" : "התחל בחינם"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg, #F4F2EC 0%, ${C.bg} 60%, #EDEAE2 100%)`, padding: mobile ? "52px 20px 48px" : "80px 24px 72px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: C.purpleLight, color: C.purple, fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, marginBottom: 18, border: `1px solid ${C.border}` }}>
            ✦ מערכת בחינות חכמה
          </div>
          <h1 style={{ fontSize: mobile ? 30 : "clamp(32px, 6vw, 54px)", fontWeight: 900, lineHeight: 1.2, margin: "0 0 16px", color: C.text }}>
            מהחומר שלכם<br />
            <span style={{ color: C.purple }}>לבחינה מוכנה</span> — בדקות
          </h1>
          <p style={{ fontSize: mobile ? 15 : 18, color: C.muted, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 28px" }}>
            מעלים PDF או סיכום, הAI בונה שאלות,<br />
            אתם עורכים ושולחים. בלי סיבוכים.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/login?signup=1")}
              style={{ padding: mobile ? "12px 28px" : "14px 36px", borderRadius: 14, border: "none", background: "#C2683D", color: "white", fontSize: mobile ? 15 : 17, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 6px 20px rgba(194,104,61,0.30)", width: mobile ? "100%" : "auto" }}>
              התחל בחינם ←
            </button>
            {!mobile && (
              <button onClick={() => document.getElementById("how").scrollIntoView({ behavior: "smooth" })}
                style={{ padding: "14px 24px", borderRadius: 14, border: `1.5px solid ${C.border}`, background: "white", color: C.text, fontSize: 15, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                איך זה עובד?
              </button>
            )}
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>
            ✓ ללא כרטיס אשראי &nbsp;·&nbsp; ✓ ניסיון חינמי &nbsp;·&nbsp; ✓ בעברית מלאה
          </div>
        </div>
      </section>

      {/* ── MOCK SCREEN ── */}
      <section style={{ background: C.bg, padding: mobile ? "0 16px 48px" : "0 24px 64px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 8px 48px rgba(83,74,183,0.10)", overflow: "hidden" }}>
          {/* fake browser bar */}
          <div style={{ background: "#f1f0f7", padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 5 }}>
              {["#FF5F57","#FFBD2E","#28CA41"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
            </div>
            <div style={{ flex: 1, background: "white", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: C.muted, border: `1px solid ${C.border}` }}>
              examai-self.vercel.app
            </div>
          </div>
          {/* mock UI */}
          <div style={{ padding: mobile ? 16 : 24, direction: "rtl" }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>שאלות במבחן (5)</div>
            {["מהו התהליך שבו צמחים הופכים אור לאנרגיה?","אילו פיגמנטים קיימים בעלי הצמחים?","מה הם התוצרים של פוטוסינתזה?"].map((q, i) => (
              <div key={i} style={{ background: i === 1 ? C.purpleLight : C.bg, border: `1px solid ${i === 1 ? C.purple : C.border}`, borderRadius: 9, padding: "9px 12px", marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: C.muted, minWidth: 16, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.text, textAlign: "right" }}>{q}</span>
                <span style={{ fontSize: 11, background: i === 1 ? C.purple : "transparent", color: i === 1 ? "white" : C.muted, padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>{i === 1 ? "✏️ עריכה" : "▼"}</span>
              </div>
            ))}
            {/* edit mode mock */}
            <div style={{ background: C.white, border: `1.5px solid ${C.purple}`, borderRadius: 9, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>עריכת שאלה 2</div>
              {[["כלורופיל a ו-b", true],["קרוטנואידים",false],["אנתוציאנינים",false],["כולם נכונים",false]].map(([opt, correct], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", borderRadius: 6, marginBottom: 4, background: correct ? C.tealLight : "transparent", border: `1px solid ${correct ? "#A9C3A0" : C.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: correct ? C.teal : C.muted, minWidth: 14 }}>{correct ? "✓" : `${i+1}.`}</span>
                  <span style={{ fontSize: 12 }}>{opt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: mobile ? "48px 20px" : "64px 24px", background: C.white }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 8 }}>איך זה עובד?</div>
            <h2 style={{ fontSize: mobile ? 22 : 32, fontWeight: 800, margin: 0 }}>שלושה צעדים פשוטים</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: mobile ? 14 : 22 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 16, padding: mobile ? "20px 20px" : "26px 24px", position: "relative", border: `1px solid ${C.border}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.purple, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: mobile ? "48px 20px" : "64px 24px", background: C.bg }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontSize: mobile ? 22 : 32, fontWeight: 800, margin: 0 }}>כל מה שצריך</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", gap: mobile ? 12 : 18 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: mobile ? "18px 18px" : "22px 22px", border: `1px solid ${C.border}`, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 26, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: mobile ? "48px 20px" : "64px 24px", background: C.white }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#C2683D", marginBottom: 8 }}>תמחור</div>
            <h2 style={{ fontSize: mobile ? 22 : 32, fontWeight: 800, margin: 0 }}>תוכנית לכל צורך</h2>
            <p style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>התחילו בחינם · ללא כרטיס אשראי · ביטול בכל עת</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: 16, alignItems: "start", marginTop: 32 }}>
            {PLANS.map((p, i) => (
              <div key={i} style={{
                background: p.highlight ? C.bg : C.white,
                border: `${p.highlight ? 2 : 1}px solid ${p.highlight ? "#C2683D" : C.border}`,
                borderRadius: 18, padding: "26px 22px", position: "relative",
                boxShadow: p.highlight ? "0 12px 32px rgba(194,104,61,0.12)" : "none",
              }}>
                {p.highlight && (
                  <div style={{ position: "absolute", top: -12, right: 22, background: "#C2683D", color: "white", fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20 }}>
                    הכי פופולרי
                  </div>
                )}
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 14 }}>{p.desc}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 18 }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: p.highlight ? "#C2683D" : C.text }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{p.period}</span>
                </div>
                <button onClick={() => navigate("/login?signup=1")}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: p.highlight ? "none" : `1.5px solid ${C.border}`, background: p.highlight ? "#C2683D" : "transparent", color: p.highlight ? "white" : C.text, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 18 }}>
                  {p.cta}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {p.features.map((f, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: C.text }}>
                      <span style={{ color: "#4F6F52", fontWeight: 800, flexShrink: 0 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: mobile ? "52px 20px" : "72px 24px", background: `linear-gradient(135deg, ${C.purple} 0%, #211F1A 100%)`, textAlign: "center" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <h2 style={{ fontSize: mobile ? 24 : 36, fontWeight: 900, color: "white", margin: "0 0 14px", lineHeight: 1.25 }}>
            מוכן לבנות בחינה בדקות?
          </h2>
          <p style={{ fontSize: mobile ? 15 : 17, color: "rgba(255,255,255,0.8)", marginBottom: 28, lineHeight: 1.6 }}>
            הצטרף ויצור את הבחינה הראשונה שלך עכשיו
          </p>
          <button onClick={() => navigate("/login?signup=1")}
            style={{ padding: mobile ? "13px 32px" : "15px 44px", borderRadius: 14, border: "none", background: "white", color: C.purple, fontSize: mobile ? 15 : 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", width: mobile ? "100%" : "auto" }}>
            התחל בחינם ←
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.text, padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <a href="/terms" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>תנאי שימוש</a>
          <a href="/privacy" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>מדיניות פרטיות</a>
          <a href="/accessibility-statement" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>הצהרת נגישות</a>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          © 2026 ExamAI · כל הזכויות שמורות
        </div>
      </footer>
    </div>
  );
}
