import React, { useState } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { DirtyProvider, useAcceptedLocation, useDirtyDraft, useDirtyState, WorkspaceProvider, useWorkspace } from './Workspace';
import { useResource } from './hooks';

const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const auth = { status: 'authenticated', authenticated: true, userId: 17, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request: vi.fn(async () => new Response('[]')), login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() } as unknown as HubRemoteProps['auth'];

const NavigationHarness: React.FC = () => {
  const accepted = useAcceptedLocation();
  const navigate = useNavigate();
  const [value, setValue] = useState('draft');
  useDirtyDraft('editor', Boolean(value));
  return <><label>Draft<input value={value} onChange={event => setValue(event.target.value)} /></label><button onClick={() => navigate(-1)}>Back</button><Routes location={accepted}><Route path="/edit" element={<><h1>Editor</h1><Link to="/next">Next</Link><Link to="/profile">Profile</Link></>} /><Route path="/next" element={<h1>Next page</h1>} /><Route path="/profile" element={<h1>Profile page</h1>} /></Routes></>;
};

describe('workspace foundations', () => {
  it('keeps its API stable and resolves links under nested mounts', () => {
    const Probe: React.FC = () => { const { api, path } = useWorkspace(); return <><span>{path('/12/player/characters')}</span><button onClick={() => void api.listCampaigns()}>Read</button></>; };
    render(<MemoryRouter initialEntries={['/groups']}><Routes><Route path="/groups/*" element={<RemoteAuthProvider auth={auth}><WorkspaceProvider><Probe /></WorkspaceProvider></RemoteAuthProvider>} /></Routes></MemoryRouter>);
    expect(screen.getByText('/groups/12/player/characters')).toBeInTheDocument();
  });
  it('hides stale resource values when the key changes', async () => {
    const first = deferred<string>(); const second = deferred<string>();
    const { result, rerender } = renderHook(({ key, load }: { key: string; load: () => Promise<string> }) => useResource(key, load), { initialProps: { key: 'one', load: () => first.promise } });
    rerender({ key: 'two', load: () => second.promise });
    expect(result.current).toMatchObject({ loading: true, data: undefined });
    act(() => { second.resolve('current'); });
    await waitFor(() => expect(result.current.data).toBe('current'));
    act(() => { first.resolve('stale'); });
    expect(result.current.data).toBe('current');
  });
  it('does not load disabled resources and invalidates their late responses', async () => {
    const pending = deferred<string>(); const load = vi.fn(() => pending.promise);
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useResource('resource', load, enabled), { initialProps: { enabled: false } });
    expect(load).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(load).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    act(() => pending.resolve('late'));
    await waitFor(() => expect(result.current).toMatchObject({ loading: false, data: undefined, error: undefined }));
  });
  it('retains same-key data while reloading and after reload errors', async () => {
    const first = deferred<string>(); const retry = deferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    const { result } = renderHook(() => useResource('same', load));
    act(() => first.resolve('cached'));
    await waitFor(() => expect(result.current.data).toBe('cached'));
    act(() => result.current.reload());
    expect(result.current).toMatchObject({ loading: true, data: 'cached' });
    act(() => retry.reject(new Error('reload failed')));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('cached');
    expect(result.current.error).toBeInstanceOf(Error);
  });
  it('keeps accepted resource data when an older pending read completes', async () => {
    const pending = deferred<string>();
    const { result } = renderHook(() => useResource('same', () => pending.promise));
    act(() => result.current.setData('accepted mutation'));
    expect(result.current).toMatchObject({ data: 'accepted mutation', loading: false });
    expect(result.current.error).toBeUndefined();
    await act(async () => pending.resolve('stale read'));
    expect(result.current.data).toBe('accepted mutation');
  });
  it('cancels dirty push navigation once and preserves the draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/edit']}><DirtyProvider><NavigationHarness /></DirtyProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Next' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Draft')).toHaveValue('draft');
    confirm.mockRestore();
  });
  it('cancels a dirty external-profile navigation without abandoning the draft', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/edit']}><DirtyProvider><NavigationHarness /></DirtyProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Draft')).toHaveValue('draft');
    confirm.mockRestore();
  });
  it('cancels dirty POP navigation without a second confirmation during rollback', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/edit', '/next']} initialIndex={1}><DirtyProvider><NavigationHarness /></DirtyProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Next page' })).toBeInTheDocument();
    confirm.mockRestore();
  });
  it('blocks beforeunload only while a registered draft is dirty and removes the handler on unmount', async () => {
    const Draft: React.FC<{ dirty: boolean }> = ({ dirty }) => { useDirtyDraft('draft', dirty); const active = useDirtyState(); return <span>{active ? 'dirty' : 'clean'}</span>; };
    const view = render(<MemoryRouter><DirtyProvider><Draft dirty /></DirtyProvider></MemoryRouter>);
    expect(await screen.findByText('dirty')).toBeInTheDocument();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    view.unmount();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });
  it('removes the navigator patch after the dirty provider unmounts', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const Parent: React.FC = () => {
      const navigate = useNavigate();
      const [guarded, setGuarded] = useState(true);
      const Draft = () => { useDirtyDraft('unmounting', true); return <h1>Guarded</h1>; };
      return <><button onClick={() => setGuarded(false)}>Unmount guard</button><button onClick={() => navigate('/next')}>Navigate</button>{guarded ? <DirtyProvider><Draft /></DirtyProvider> : <h1>Unprotected</h1>}<Routes><Route path="/next" element={<h1>Next page</h1>} /></Routes></>;
    };
    render(<MemoryRouter initialEntries={['/']}><Parent /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Guarded' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unmount guard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    expect(await screen.findByRole('heading', { name: 'Next page' })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
