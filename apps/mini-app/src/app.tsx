import { useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./lib/query-client";
import { useAppStore } from "./stores/app-store";
import { useAuthStore } from "./stores/auth-store";
import "./lib/abort-polyfill";
import "./app.scss";

interface Props {
  children: ReactNode;
}

function App({ children }: Props) {
  const setReady = useAppStore((s) => s.setReady);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    const init = async () => {
      await hydrate();
      setReady();
    };
    init();
  }, [hydrate, setReady]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default App;
