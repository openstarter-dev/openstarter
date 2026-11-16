// 微信小程序无原生 AbortController，而 query-core 每次 fetch 无条件 new AbortController()。
type AbortListener = () => void;

function createAbortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function createAbortController() {
  const listeners = new Map<AbortListener, boolean>();
  const signal = {
    aborted: false,
    reason: undefined as unknown,
    addEventListener(type: string, listener: AbortListener, options?: { once?: boolean }) {
      if (type === "abort") {
        listeners.set(listener, options?.once === true);
      }
    },
    removeEventListener(type: string, listener: AbortListener) {
      if (type === "abort") {
        listeners.delete(listener);
      }
    },
  };

  return {
    signal,
    abort(reason?: unknown) {
      if (signal.aborted) {
        return;
      }
      signal.aborted = true;
      signal.reason = reason ?? createAbortError();
      for (const [listener, once] of [...listeners]) {
        if (once) {
          listeners.delete(listener);
        }
        listener();
      }
    },
  };
}

if (typeof globalThis.AbortController === "undefined") {
  globalThis.AbortController = createAbortController as unknown as typeof AbortController;
}

export {};
