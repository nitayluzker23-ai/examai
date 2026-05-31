import { Link } from "react-router-dom";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.1)", bg: "#f8f7ff", white: "#fff",
};

function LegalLayout({ title, updated, children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "16px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ fontSize: 20, fontWeight: 800, color: C.purple, textDecoration: "none" }}>ExamAI</Link>
          <Link to="/" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>← חזרה לדף הבית</Link>
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 60px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>{title}</h1>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>עודכן לאחרונה: {updated}</div>
        <div style={{ fontSize: 15, color: C.text, lineHeight: 1.9 }}>{children}</div>
      </div>
    </div>
  );
}

function Section({ heading, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.purple, margin: "0 0 8px" }}>{heading}</h2>
      <div style={{ color: "#333" }}>{children}</div>
    </div>
  );
}

// ── Terms of Service ──────────────────────────────────────
export function TermsPage() {
  return (
    <LegalLayout title="תנאי שימוש" updated="31 במאי 2026">
      <Section heading="1. כללי">
        ExamAI ("השירות") היא פלטפורמה ליצירת מבחנים מבוססת בינה מלאכותית. השימוש בשירות מהווה הסכמה לתנאים אלה.
        אם אינך מסכים לתנאים, אנא הימנע משימוש בשירות.
      </Section>
      <Section heading="2. החשבון שלך">
        אתה אחראי לשמירת סודיות פרטי ההתחברות שלך ולכל פעילות המתבצעת בחשבונך.
        יש להזין פרטים מדויקים ועדכניים בעת ההרשמה.
      </Section>
      <Section heading="3. שימוש מותר">
        השירות מיועד ליצירת מבחנים ותכני הערכה לצרכים חינוכיים ומקצועיים לגיטימיים.
        אין להשתמש בשירות לתוכן בלתי חוקי, פוגעני, או המפר זכויות של צד שלישי.
      </Section>
      <Section heading="4. תוכן שהועלה">
        אתה שומר על הבעלות בתוכן שאתה מעלה (חומרי לימוד, מבחנים). אתה מצהיר שיש לך את הזכויות
        הנדרשות בתוכן זה. השאלות נוצרות באמצעות בינה מלאכותית ובאחריותך לבדוק את נכונותן לפני שימוש.
      </Section>
      <Section heading="5. הגבלת אחריות">
        השירות מסופק "כפי שהוא" (AS IS). איננו מתחייבים לדיוק מוחלט של השאלות שנוצרות על ידי ה-AI.
        מומלץ לבדוק כל שאלה לפני העברתה לנבחנים. לא נישא באחריות לנזק עקיף הנובע מהשימוש.
      </Section>
      <Section heading="6. תשלומים ומנויים">
        תוכניות בתשלום מחויבות לפי התעריף המוצג. ניתן לבטל מנוי בכל עת; הביטול ייכנס לתוקף בסוף תקופת החיוב.
      </Section>
      <Section heading="7. שינויים בתנאים">
        אנו רשאים לעדכן תנאים אלה מעת לעת. המשך השימוש לאחר עדכון מהווה הסכמה לתנאים המעודכנים.
      </Section>
      <Section heading="8. יצירת קשר">
        לשאלות בנוגע לתנאי השימוש: <a href="mailto:nitayluzker23@gmail.com" style={{ color: C.purple }}>nitayluzker23@gmail.com</a>
      </Section>
    </LegalLayout>
  );
}

// ── Privacy Policy ────────────────────────────────────────
export function PrivacyPage() {
  return (
    <LegalLayout title="מדיניות פרטיות" updated="31 במאי 2026">
      <Section heading="1. מבוא">
        אנו מכבדים את פרטיותך. מדיניות זו מסבירה איזה מידע אנו אוספים, כיצד אנו משתמשים בו ומה הזכויות שלך.
      </Section>
      <Section heading="2. מידע שאנו אוספים">
        <ul style={{ paddingRight: 20, margin: 0 }}>
          <li>פרטי חשבון: שם, כתובת אימייל.</li>
          <li>תוכן שאתה מעלה: חומרי לימוד, מבחנים, שאלות.</li>
          <li>פרטי תלמידים שאתה מזין (שם, טלפון, כתובת) — באחריותך לקבל הסכמה מתאימה.</li>
          <li>נתוני שימוש טכניים: סוג דפדפן, פעולות באתר.</li>
        </ul>
      </Section>
      <Section heading="3. כיצד אנו משתמשים במידע">
        המידע משמש לאספקת השירות, שיפורו, יצירת שאלות באמצעות AI, ותמיכה. תוכן הלימוד נשלח לספק ה-AI
        (Anthropic) לצורך יצירת השאלות בלבד.
      </Section>
      <Section heading="4. אחסון ואבטחה">
        הנתונים נשמרים בשרתי Supabase מאובטחים. אנו נוקטים אמצעי אבטחה סבירים להגנה על המידע,
        אך לא ניתן להבטיח אבטחה מוחלטת.
      </Section>
      <Section heading="5. שיתוף מידע">
        איננו מוכרים את המידע שלך. אנו משתפים מידע רק עם ספקי שירות הכרחיים (אחסון, AI) ובהתאם לחוק.
      </Section>
      <Section heading="6. הזכויות שלך">
        זכותך לעיין במידע שלך, לתקנו או לבקש את מחיקתו. לפנייה: <a href="mailto:nitayluzker23@gmail.com" style={{ color: C.purple }}>nitayluzker23@gmail.com</a>
      </Section>
      <Section heading="7. עוגיות">
        אנו משתמשים בעוגיות הכרחיות לתפעול השירות (כגון שמירת התחברות). ניתן לחסום עוגיות בהגדרות הדפדפן.
      </Section>
    </LegalLayout>
  );
}

// ── Accessibility Statement (Israeli legal requirement) ───
export function AccessibilityStatementPage() {
  return (
    <LegalLayout title="הצהרת נגישות" updated="31 במאי 2026">
      <Section heading="מחויבות לנגישות">
        ExamAI רואה חשיבות רבה במתן שירות נגיש ושוויוני לכלל המשתמשים, לרבות אנשים עם מוגבלות,
        בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998 ולתקנות הנגישות (ת"י 5568).
      </Section>
      <Section heading="התאמות הנגישות באתר">
        באתר מוטמע תפריט נגישות (לחצן ♿ בפינה השמאלית התחתונה) המאפשר:
        <ul style={{ paddingRight: 20, marginTop: 8 }}>
          <li>הגדלה והקטנה של גודל הטקסט</li>
          <li>מצב ניגודיות גבוהה</li>
          <li>תצוגת גווני אפור</li>
          <li>הדגשת קישורים</li>
          <li>גופן קריא</li>
          <li>סמן עכבר מוגדל</li>
          <li>עצירת אנימציות</li>
        </ul>
      </Section>
      <Section heading="רמת הנגישות">
        האתר נבנה בהתאם להנחיות WCAG 2.1 ברמה AA ככל שניתן. אנו פועלים לשיפור מתמיד של הנגישות.
      </Section>
      <Section heading="פניות בנושא נגישות">
        נתקלת בבעיית נגישות? נשמח לסייע. רכז הנגישות: ניתאי
        <br />
        אימייל: <a href="mailto:nitayluzker23@gmail.com" style={{ color: C.purple }}>nitayluzker23@gmail.com</a>
        <br />
        נשתדל להגיב לפנייתך בהקדם האפשרי.
      </Section>
    </LegalLayout>
  );
}
