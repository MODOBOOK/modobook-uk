// Treatment finder quiz definition. 8 questions, all multiple-choice.
// Each question's `id` maps 1:1 to the matching tag bucket on `treatments.quiz_tags`.

export type QuizQuestion = {
  id: "areas" | "outcome" | "downtime" | "timeframe" | "needle" | "experience" | "age" | "skin";
  label: string;
  helper?: string;
  multi: boolean;
  options: string[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "areas",
    label: "Which area would you like to focus on?",
    helper: "Pick all that apply",
    multi: true,
    options: [
      "Forehead & frown lines",
      "Eyes & crow's feet",
      "Cheeks & midface",
      "Lips",
      "Jawline & chin",
      "Neck & décolletage",
      "Skin texture & tone",
      "Pigmentation",
      "Acne & scarring",
      "Body",
    ],
  },
  {
    id: "outcome",
    label: "What kind of result are you hoping for?",
    multi: false,
    options: ["Subtle refresh", "Noticeable but natural", "Dramatic transformation"],
  },
  {
    id: "downtime",
    label: "How much downtime can you tolerate?",
    multi: false,
    options: ["None", "1–2 days", "Up to a week", "Happy with longer"],
  },
  {
    id: "timeframe",
    label: "When do you want to see results?",
    multi: false,
    options: ["Within 2 weeks", "1–3 months", "No rush"],
  },
  {
    id: "needle",
    label: "How do you feel about injections?",
    multi: false,
    options: ["Fine with injections", "Prefer non-injectable if possible", "Needle-averse"],
  },
  {
    id: "experience",
    label: "Have you had aesthetic treatments before?",
    multi: false,
    options: ["First-timer", "Some experience", "Very experienced"],
  },
  {
    id: "age",
    label: "Which age bracket are you in?",
    multi: false,
    options: ["Under 25", "25–34", "35–44", "45–54", "55+"],
  },
  {
    id: "skin",
    label: "Which best describes your skin?",
    helper: "Pick all that apply",
    multi: true,
    options: ["Dry", "Oily", "Combination", "Sensitive", "Acne-prone", "Pigmentation", "Redness / rosacea"],
  },
];

export type QuizAnswers = Partial<Record<QuizQuestion["id"], string[]>>;
export type QuizTags = Partial<Record<QuizQuestion["id"], string[]>>;

/** Score a treatment against the patient's answers — simple overlap count. */
export function scoreTreatment(answers: QuizAnswers, tags: QuizTags): number {
  let score = 0;
  for (const q of QUIZ_QUESTIONS) {
    const pickedRaw = answers[q.id] ?? [];
    const taggedRaw = tags[q.id] ?? [];
    if (!pickedRaw.length || !taggedRaw.length) continue;
    const tagged = new Set(taggedRaw);
    for (const p of pickedRaw) if (tagged.has(p)) score += q.multi ? 1 : 2;
  }
  return score;
}
