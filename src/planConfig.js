// ── ExamAI Plan Definitions ──────────────────────────────
// 1 page ≈ 1500 Hebrew characters (A4 standard)

export const PLANS = {
  free: {
    label:           "חינם",
    labelEn:         "free",
    color:           "#6b7280",
    bg:              "#f3f4f6",
    price_month:     0,
    exams_per_month: 3,
    text_chars:      4500,   // 3 pages
    max_students:    1,
    features: {
      ai_text:           true,
      ai_image:          false,
      past_exams:        false,
      pdf_export:        false,
      student_management:false,
      question_images:   false,
      schedule:          false,
      reinforcement:     false,
      student_portal:    false,
    },
  },

  teacher: {
    label:           "מורה",
    labelEn:         "teacher",
    color:           "#854F0B",
    bg:              "#FAEEDA",
    price_month:     49,
    exams_per_month: 10,
    text_chars:      9000,   // 6 pages
    max_students:    20,
    features: {
      ai_text:           true,
      ai_image:          false,
      past_exams:        false,
      pdf_export:        true,
      student_management:true,
      question_images:   false,
      schedule:          true,
      reinforcement:     true,
      student_portal:    false,
    },
  },

  pro: {
    label:           "פרו",
    labelEn:         "pro",
    color:           "#534AB7",
    bg:              "#EEEDFE",
    price_month:     99,
    exams_per_month: 20,
    text_chars:      Infinity,
    max_students:    Infinity,
    features: {
      ai_text:           true,
      ai_image:          true,
      past_exams:        true,
      pdf_export:        true,
      student_management:true,
      question_images:   true,
      schedule:          true,
      reinforcement:     true,
      student_portal:    true,
    },
  },
};

// Helper: get plan config (falls back to free)
export const getPlan = (planKey) => PLANS[planKey] ?? PLANS.free;

// Human-readable page count from char limit
export const charsToPages = (chars) =>
  chars === Infinity ? "ללא הגבלה" : `${Math.round(chars / 1500)} עמודים`;
