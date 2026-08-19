import { useEffect, type ReactNode } from "react";
import { useAppStore } from "./stores/app-store";
import { useAuthStore } from "./stores/auth-store";
import "./app.scss";

interface Props {
  children: ReactNode;
}

function App({ children }: Props) {
  const setReady = useAppStore((s) => s.setReady);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    const init = async () => {
      await hydrate();
      setReady();
    };
    init();
  }, [hydrate, setReady]);

  return <>{children}</>;
}

export default App;
