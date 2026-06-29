export type FaqEntry = {
  question: string;
  answer: string;
};

// TODO: replace with your own FAQ entries.
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Is there a free trial?",
    answer: "Yes — the Starter tier is free forever, no card required.",
  },
  {
    question: "Which payment methods do you accept?",
    answer: "All major credit cards, billed securely through Stripe.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. You can downgrade or cancel from your account settings.",
  },
  {
    question: "Where is my data stored?",
    answer: "Your data lives in the database connection you configure.",
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer prorated refunds within the first 14 days.",
  },
  {
    question: "How do I get support?",
    answer: "Email our team or open an issue on the project repository.",
  },
];
