import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPath, UNSAFE_NavigationContext, UNSAFE_RouteContext, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { To } from 'react-router-dom';
import { useAuth } from '@tdn/shared';
import type { AuthenticatedRequest } from '@tdn/shared';
import { createCampaignApi } from './api';
import { VisitHistoryProvider } from './VisitHistory';

type WorkspaceValue = { api: ReturnType<typeof createCampaignApi>; mountPath: string; path: (relative?: string) => string; navigate: ReturnType<typeof useNavigate>; sessionKey: string };
const Context = createContext<WorkspaceValue | null>(null);
export const WorkspaceProvider: React.FC<React.PropsWithChildren<{ mountPath?: string }>> = ({ children, mountPath }) => {
  const auth = useAuth();
  const routeContext = useContext(UNSAFE_RouteContext);
  const navigate = useNavigate();
  const sessionKey = String(auth.userId);
  const matchedRoute = routeContext.matches[routeContext.matches.length - 1];
  const matchedBase = matchedRoute?.pathnameBase ?? '/';
  const base = (mountPath ?? matchedBase).replace(/\/$/, '') || '/';
  const api = useMemo(() => createCampaignApi(auth.request as AuthenticatedRequest), [auth.request]);
  const path = useCallback((relative = '') => {
    const result = `${base === '/' ? '' : base}${relative.startsWith('/') ? relative : relative ? `/${relative}` : ''}`;
    return result.replace(/\/$/, '') || '/';
  }, [base]);
  const value = useMemo(() => ({ api, mountPath: base, path, navigate, sessionKey }), [api, base, path, navigate, sessionKey]);
  return <Context.Provider value={value}><VisitHistoryProvider key={sessionKey} sessionKey={sessionKey}>{children}</VisitHistoryProvider></Context.Provider>;
};
export const useWorkspace = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useWorkspace requires WorkspaceProvider');
  return value;
};

type NavigationCall = (to: To, state?: unknown, options?: unknown) => void;
type NavigatorLike = { push: NavigationCall; replace: NavigationCall };
type NavigationGuard = { dirty: React.MutableRefObject<boolean>; currentPath: React.MutableRefObject<string>; confirmedPath: React.MutableRefObject<string | null>; bypassPath: React.MutableRefObject<string | null> };
type NavigatorPatch = { guards: Set<NavigationGuard>; originalPush: NavigationCall; originalReplace: NavigationCall; wrappedPush: NavigationCall; wrappedReplace: NavigationCall };
const navigatorPatches = new WeakMap<object, NavigatorPatch>();
const toPath = (to: To) => typeof to === 'string' ? to : createPath(to);
const patchNavigator = (navigator: object, guard: NavigationGuard) => {
  let patch = navigatorPatches.get(navigator);
  if (!patch) {
    const mutable = navigator as unknown as NavigatorLike;
    const originalPush = mutable.push;
    const originalReplace = mutable.replace;
    const guards = new Set<NavigationGuard>();
    const allow = (to: To) => {
      const target = toPath(to);
      const bypass = Array.from(guards).find(item => item.bypassPath.current === target);
      if (bypass) { bypass.bypassPath.current = null; return true; }
      const active = Array.from(guards).filter(item => item.dirty.current && item.currentPath.current !== target);
      if (!active.length) return true;
      if (!window.confirm('Есть несохранённые изменения. Покинуть страницу?')) return false;
      for (const item of guards) item.confirmedPath.current = target;
      return true;
    };
    const wrappedPush: NavigationCall = (to, state, options) => { if (allow(to)) originalPush(to, state, options); };
    const wrappedReplace: NavigationCall = (to, state, options) => { if (allow(to)) originalReplace(to, state, options); };
    mutable.push = wrappedPush;
    mutable.replace = wrappedReplace;
    patch = { guards, originalPush, originalReplace, wrappedPush, wrappedReplace };
    navigatorPatches.set(navigator, patch);
  }
  patch.guards.add(guard);
  return () => {
    patch?.guards.delete(guard);
    if (patch && patch.guards.size === 0) {
      const mutable = navigator as unknown as NavigatorLike;
      if (mutable.push === patch.wrappedPush) mutable.push = patch.originalPush;
      if (mutable.replace === patch.wrappedReplace) mutable.replace = patch.originalReplace;
      navigatorPatches.delete(navigator);
    }
  };
};

type DirtyValue = { setDirty: (owner: string, dirty: boolean) => void; unregister: (owner: string) => void; isDirty: boolean; confirmedPath: React.MutableRefObject<string | null>; bypassPath: React.MutableRefObject<string | null> };
const DirtyContext = createContext<DirtyValue | null>(null);
export const DirtyProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const [owners, setOwners] = useState<Record<string, boolean>>({});
  const ownersRef = useRef(owners);
  ownersRef.current = owners;
  const dirtyRef = useRef(false);
  dirtyRef.current = Object.values(owners).some(Boolean);
  const confirmedPath = useRef<string | null>(null);
  const bypassPath = useRef<string | null>(null);
  const currentPath = useRef(createPath(location));
  currentPath.current = createPath(location);
  const setDirty = useCallback((owner: string, dirty: boolean) => {
    const current = ownersRef.current;
    if (current[owner] === dirty) return;
    const next = { ...current, [owner]: dirty };
    ownersRef.current = next;
    dirtyRef.current = Object.values(next).some(Boolean);
    setOwners(next);
  }, []);
  const unregister = useCallback((owner: string) => {
    const current = ownersRef.current;
    if (!Object.prototype.hasOwnProperty.call(current, owner)) return;
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => key !== owner));
    ownersRef.current = next;
    dirtyRef.current = Object.values(next).some(Boolean);
    setOwners(next);
  }, []);
  const isDirty = Object.values(owners).some(Boolean);
  const guard = useMemo(() => ({ dirty: dirtyRef, currentPath, confirmedPath, bypassPath }), []);
  useLayoutEffect(() => patchNavigator(navigator, guard), [navigator, guard]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const value = useMemo(() => ({ setDirty, unregister, isDirty, confirmedPath, bypassPath }), [setDirty, unregister, isDirty]);
  return <DirtyContext.Provider value={value}>{children}</DirtyContext.Provider>;
};
export const useDirtyState = () => useContext(DirtyContext)?.isDirty ?? false;
export const useAcceptedLocation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const dirtyContext = useContext(DirtyContext);
  const dirty = useDirtyState();
  const [accepted, setAccepted] = useState(location);
  useLayoutEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const acceptedPath = `${accepted.pathname}${accepted.search}${accepted.hash}`;
    if (currentPath === acceptedPath) {
      if (dirtyContext?.confirmedPath.current === currentPath) dirtyContext.confirmedPath.current = null;
      if (location.key !== accepted.key) setAccepted(location);
      return;
    }
    if (navigationType !== 'POP' || dirtyContext?.confirmedPath.current === currentPath) {
      if (dirtyContext?.confirmedPath.current === currentPath) dirtyContext.confirmedPath.current = null;
      setAccepted(location);
      return;
    }
    if (!dirty || window.confirm('Есть несохранённые изменения. Покинуть страницу?')) {
      setAccepted(location);
      return;
    }
    if (dirtyContext) dirtyContext.bypassPath.current = acceptedPath;
    navigate(acceptedPath, { replace: true });
  }, [location, accepted, dirty, dirtyContext, navigationType, navigate]);
  return accepted;
};
export const useDirtyDraft = (owner: string, dirty: boolean) => {
  const context = useContext(DirtyContext);
  const setDirty = context?.setDirty;
  const unregister = context?.unregister;
  useEffect(() => { setDirty?.(owner, dirty); }, [setDirty, owner, dirty]);
  useEffect(() => () => unregister?.(owner), [unregister, owner]);
  return useCallback(() => setDirty?.(owner, false), [setDirty, owner]);
};
