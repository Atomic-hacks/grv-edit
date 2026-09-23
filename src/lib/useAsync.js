import { useCallback, useEffect, useState } from "react";

// Generic async-fetch hook: wraps a promise-returning fn in {data, loading,
// error} state. fn is re-invoked whenever deps change, or on demand via the
// returned refetch — the retry button on a failed page needs a way back in
// without a full reload.
export const useAsync = (fn, deps) => {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retryToken]);

  const refetch = useCallback(() => setRetryToken((token) => token + 1), []);

  return { ...state, refetch };
};
