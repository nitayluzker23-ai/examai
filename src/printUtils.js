const FONT = "'Noto Sans Hebrew','Segoe UI',Arial,sans-serif";

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${FONT}; direction: rtl; color: #1a1a2e; background: white; padding: 28px 32px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; font-weight: 800; color: #534AB7; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #1a1a2e; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
  .divider { border: none; border-top: 1.5px solid #e5e7eb; margin: 18px 0; }
  .question { margin-bottom: 18px; page-break-inside: avoid; }
  .question-num { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
  .question-text { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .option { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; font-size: 13px; }
  .letter { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #d1d5db; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
  .correct .letter { background: #0F6E56; border-color: #0F6E56; color: white; }
  .correct-text { color: #0F6E56; font-weight: 500; }
  .wrong-text { color: #A32D2D; }
  .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; margin-right: 6px; }
  .badge-easy   { background: #E1F5EE; color: #0F6E56; }
  .badge-medium { background: #EEEDFE; color: #534AB7; }
  .badge-hard   { background: #FAEEDA; color: #854F0B; }
  .topic-row { margin-bottom: 10px; }
  .topic-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
  .bar-bg { height: 7px; background: #f0f0f8; border-radius: 4px; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .score-big { font-size: 48px; font-weight: 800; line-height: 1; }
  .score-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .tip-box { border-radius: 10px; padding: 10px 14px; margin: 6px 0; font-size: 12px; }
  .explanation { background: #FCEBEB; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #791F1F; margin-top: 8px; }
  @media print { body { padding: 10px 18px; } }
`;

function openPrint(html) {
  const win = window.open("", "_blank");
  if (!win) { alert("נא לאפשר חלונות קופצים בדפדפן"); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ── Export exam questions (no correct answer shown) ────────
export function printExam(exam, questions) {
  const LETTERS = "אבגד";
  const DIFF_HE = { Easy: "קל", Medium: "בינוני", Hard: "קשה" };
  const DIFF_CLS = { Easy: "easy", Medium: "medium", Hard: "hard" };

  const now = new Date().toLocaleDateString("he-IL");

  const qs = questions.map((q, idx) => {
    const c = q.content ?? {};
    const diff = q.difficulty ?? "Medium";
    const opts = (c.options ?? []).map((opt, i) =>
      `<div class="option">
        <div class="letter">${LETTERS[i]}</div>
        <span>${opt}</span>
      </div>`
    ).join("");
    return `
      <div class="question">
        <div class="question-num">
          שאלה ${idx + 1}
          <span class="badge badge-${DIFF_CLS[diff]}">${DIFF_HE[diff] ?? diff}</span>
          ${c.topic_name ? `<span style="font-size:11px;color:#6b7280">${c.topic_name}</span>` : ""}
        </div>
        <div class="question-text">${c.question_text ?? ""}</div>
        ${opts}
      </div>`;
  }).join('<hr class="divider">');

  const html = `
    <h1>${exam.title ?? "מבחן"}</h1>
    <div class="meta">
      ${exam.subject ?? ""} · ${questions.length} שאלות · הודפס ${now}
      ${exam.access_code ? ` · קוד: <strong>${exam.access_code}</strong>` : ""}
    </div>
    <hr class="divider">
    ${qs}
    <hr class="divider">
    <div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px">הופק על ידי ExamAI</div>
  `;
  openPrint(html);
}

// ── Export exam with answer key (for teacher) ──────────────
export function printAnswerKey(exam, questions) {
  const LETTERS = "אבגד";
  const DIFF_HE = { Easy: "קל", Medium: "בינוני", Hard: "קשה" };
  const DIFF_CLS = { Easy: "easy", Medium: "medium", Hard: "hard" };

  const qs = questions.map((q, idx) => {
    const c = q.content ?? {};
    const diff = q.difficulty ?? "Medium";
    const opts = (c.options ?? []).map((opt, i) => {
      const isCorrect = i === c.correct_answer_index;
      return `<div class="option ${isCorrect ? "correct" : ""}">
        <div class="letter">${LETTERS[i]}</div>
        <span class="${isCorrect ? "correct-text" : ""}">${opt}</span>
      </div>`;
    }).join("");
    return `
      <div class="question">
        <div class="question-num">
          שאלה ${idx + 1}
          <span class="badge badge-${DIFF_CLS[diff]}">${DIFF_HE[diff] ?? diff}</span>
        </div>
        <div class="question-text">${c.question_text ?? ""}</div>
        ${opts}
        ${c.ai_explanation ? `<div class="explanation">${c.ai_explanation}</div>` : ""}
      </div>`;
  }).join('<hr class="divider">');

  const html = `
    <h1>${exam.title ?? "מבחן"} — מפתח תשובות</h1>
    <div class="meta">${exam.subject ?? ""} · ${questions.length} שאלות</div>
    <hr class="divider">
    ${qs}
  `;
  openPrint(html);
}

// ── Export student personal report ────────────────────────
export function printStudentReport(exam, questions, answers, studentName) {
  const LETTERS = "אבגד";
  const correct = answers.filter((a, i) => a?.selected_index === questions[i]?.content?.correct_answer_index).length;
  const pct = Math.round((correct / questions.length) * 100);
  const scoreColor = pct >= 80 ? "#0F6E56" : pct >= 60 ? "#854F0B" : "#A32D2D";

  // Topic breakdown
  const statsMap = {};
  questions.forEach((q, i) => {
    const a = answers[i];
    const tid  = q.content?.source_topic_id ?? q.source_topic_id ?? "כללי";
    const name = q.content?.topic_name ?? tid;
    if (!statsMap[tid]) statsMap[tid] = { name, total: 0, correct: 0 };
    statsMap[tid].total++;
    if (a?.selected_index === q.content?.correct_answer_index) statsMap[tid].correct++;
  });
  const topics = Object.values(statsMap).sort((a, b) => (a.correct / a.total) - (b.correct / b.total));

  const topicsHtml = topics.length > 1 ? `
    <h2>ביצועים לפי נושא</h2>
    ${topics.map(t => {
      const p = Math.round((t.correct / t.total) * 100);
      const col = p >= 80 ? "#0F6E56" : p >= 50 ? "#854F0B" : "#A32D2D";
      return `<div class="topic-row">
        <div class="topic-label"><span>${t.name}</span><span style="color:${col};font-weight:600">${t.correct}/${t.total} (${p}%)</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${p}%;background:${col}"></div></div>
      </div>`;
    }).join("")}
    <hr class="divider">
  ` : "";

  // Questions review
  const reviewHtml = questions.map((q, i) => {
    const a = answers[i];
    const c = q.content ?? {};
    const isSkip    = !a || a.selected_index === -1;
    const isCorrect = !isSkip && a.selected_index === c.correct_answer_index;
    const icon = isSkip ? "—" : isCorrect ? "✓" : "✗";
    const borderColor = isSkip ? "#e5e7eb" : isCorrect ? "#5DCAA5" : "#F09595";
    return `
      <div style="border:1px solid ${borderColor};border-radius:10px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px">${i + 1}. ${c.question_text ?? ""}</div>
            ${isSkip
              ? `<div style="font-size:12px;color:#6b7280">לא נענה</div>`
              : isCorrect
                ? `<div style="font-size:12px;color:#0F6E56">תשובה נכונה ✓</div>`
                : `<div style="font-size:12px;color:#A32D2D">
                    ענית: ${c.options?.[a.selected_index] ?? "—"}<br>
                    נכון: ${c.options?.[c.correct_answer_index] ?? "—"}
                  </div>`
            }
            ${!isSkip && !isCorrect && c.ai_explanation
              ? `<div class="explanation">${c.ai_explanation}</div>`
              : ""}
          </div>
          <div style="font-size:18px;flex-shrink:0">${icon}</div>
        </div>
      </div>`;
  }).join("");

  const now = new Date().toLocaleDateString("he-IL");
  const html = `
    <h1>${exam?.title ?? "מבחן"}</h1>
    <div class="meta">${studentName} · ${exam?.subject ?? ""} · ${now}</div>
    <hr class="divider">

    <div style="text-align:center;margin-bottom:20px">
      <div class="score-big" style="color:${scoreColor}">${pct}%</div>
      <div class="score-sub">${correct} מתוך ${questions.length} נכון</div>
    </div>
    <hr class="divider">

    ${topicsHtml}

    <h2>סקירת שאלות</h2>
    ${reviewHtml}
    <hr class="divider">
    <div style="font-size:11px;color:#9ca3af;text-align:center">הופק על ידי ExamAI</div>
  `;
  openPrint(html);
}
