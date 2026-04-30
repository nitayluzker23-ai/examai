import { useParams, Link } from "react-router-dom";

const C = {
  purple: "#534AB7",
  purpleLight: "#EEEDFE",
  text: "#1a1a2e",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.09)",
  bg: "#f8f7ff",
  white: "#fff",
};

export default function ExamQuestionsPage() {
  const { examId } = useParams();

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif",
        direction: "rtl",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <Link
          to="/dashboard/exams"
          style={{ fontSize: 13, color: C.purple, textDecoration: "none" }}
        >
          ← חזרה לרשימת המבחנים
        </Link>
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: C.text,
          marginBottom: 8,
        }}
      >
        שאלות במבחן
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
        מזהה מבחן: <code>{examId}</code>
      </div>

      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 24,
          maxWidth: 720,
        }}
      >
        <div style={{ fontSize: 15, color: C.text, marginBottom: 8 }}>
          הדף הזה עוד בבנייה
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          כאן יוצגו השאלות של המבחן הנבחר, יחד עם אפשרויות עריכה, מחיקה
          והוספה. רכיב מלא יתווסף בהמשך.
        </div>
      </div>
    </div>
  );
}
