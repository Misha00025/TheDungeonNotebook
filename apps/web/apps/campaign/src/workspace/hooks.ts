import { useCallback, useEffect, useRef, useState } from 'react';

export function useResource<T>(key: string, load: () => Promise<T>, enabled = true) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [state, setState] = useState<{ key: string; enabled: boolean; data?: T; loading: boolean; error?: unknown }>({ key, enabled, loading: enabled });
  const [tick, setTick] = useState(0);
  const keyRef = useRef(key);
  keyRef.current = key;
  const stateRef = useRef(state);
  stateRef.current = state;
  const reload = useCallback(() => {
    setState(current => {
      if (!enabledRef.current) return { key: keyRef.current, enabled: false, loading: false, data: undefined, error: undefined };
      const data = current.enabled && current.key === keyRef.current ? current.data : undefined;
      return { key: keyRef.current, enabled: true, loading: true, data };
    });
    if (enabledRef.current) setTick(value => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ key, enabled: false, loading: false, data: undefined, error: undefined });
      return () => { active = false; };
    }
    const previous = stateRef.current.key === key && stateRef.current.enabled ? stateRef.current.data : undefined;
    setState({ key, enabled: true, loading: true, data: previous });
    loadRef.current().then(
      data => { if (active) setState({ key, enabled: true, data, loading: false }); },
      error => { if (active) setState({ key, enabled: true, data: previous, error, loading: false }); }
    );
    return () => { active = false; };
  }, [key, tick, enabled]);
  const current = !enabled
    ? { key, enabled: false, data: undefined, error: undefined, loading: false }
    : state.key === key && state.enabled
      ? state
      : { key, enabled: true, data: undefined, error: undefined, loading: true };
  return { ...current, reload };
}

export function useMutation<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    if (mountedRef.current) { setBusy(true); setError(undefined); }
    try { return await actionRef.current(...args); }
    catch (failure) { if (mountedRef.current) setError(failure); throw failure; }
    finally { busyRef.current = false; if (mountedRef.current) setBusy(false); }
  }, []);
  return { busy, error, status: busy ? 'pending' : error ? 'error' : 'idle', run };
}
