import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  const showToast = useCallback((message) => {
    setToast({ id: Date.now(), message });
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 border border-black bg-black px-4 py-3 text-sm text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={dismissToast}
            className="text-lg leading-none text-white/70 hover:text-white"
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};
