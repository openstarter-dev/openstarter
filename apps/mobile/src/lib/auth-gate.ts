export type AuthGate = "loading" | "authenticated" | "unauthenticated";

export function deriveAuthGate(input: {
  session: { user?: { id: string } | undefined } | null | undefined;
  isPending: boolean;
}): AuthGate {
  if (input.isPending) {
    return "loading";
  }
  return input.session?.user ? "authenticated" : "unauthenticated";
}
