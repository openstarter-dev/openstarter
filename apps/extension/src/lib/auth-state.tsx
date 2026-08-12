import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthStateContextValue {
  isSignedOut: boolean;
  setSignedOut: () => void;
  clearSignedOut: () => void;
}

export const AuthStateContext = createContext<AuthStateContextValue | null>(null);

export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [isSignedOut, setSignedOutState] = useState(false);
  return (
    <AuthStateContext.Provider
      value={{
        isSignedOut,
        setSignedOut: () => setSignedOutState(true),
        clearSignedOut: () => setSignedOutState(false),
      }}
    >
      {children}
    </AuthStateContext.Provider>
  );
}

export function useIsSignedOut() {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error("useIsSignedOut must be used within AuthStateProvider");
  return ctx.isSignedOut;
}

export function useSetSignedOut() {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error("useSetSignedOut must be used within AuthStateProvider");
  return ctx.setSignedOut;
}
