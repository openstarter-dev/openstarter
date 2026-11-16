export type EmailLocale = "en" | "zh";

export const resolveEmailLocale = (locale: string): EmailLocale => {
  const [base] = locale.trim().toLowerCase().split("-");
  return base === "zh" ? "zh" : "en";
};
