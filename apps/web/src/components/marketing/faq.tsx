import { ChevronDown } from "lucide-react";

import { FAQ_ENTRIES } from "@/lib/marketing/faq";

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Frequently asked questions
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {FAQ_ENTRIES.map((entry) => (
          <details
            key={entry.question}
            name="faq"
            className="group rounded-lg border bg-card px-4 py-3"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              {entry.question}
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-muted-foreground text-sm">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
