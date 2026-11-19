import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useResolvedPath } from 'react-router-dom';
import RemoteBoundary from './RemoteBoundary';
import type { RemoteModule, RemoteProps } from './types';

const mocks = vi.hoisted(() => ({ loadRemoteModule: vi.fn() }));

vi.mock('./loadRemote', () => ({ loadRemoteModule: mocks.loadRemoteModule }));

const auth = {} as RemoteProps['auth'];
const onCompleted = vi.fn(async () => {});
const RemoteView = ({ auth: receivedAuth, onCompleted: receivedOnCompleted }: RemoteProps) => (
  <div data-testid="remote-view" data-auth={receivedAuth === auth} data-completed={receivedOnCompleted === onCompleted} />
);
const remoteModule: RemoteModule = { default: RemoteView };

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('RemoteBoundary', () => {
  beforeEach(() => {
    mocks.loadRemoteModule.mockReset();
  });

  it('shows loading while pending and renders the remote with unchanged props on success', async () => {
    const pending = deferred<RemoteModule>();
    mocks.loadRemoteModule.mockReturnValue(pending.promise);
    render(<RemoteBoundary name="profile" module="App" auth={auth} onCompleted={onCompleted} />);

    expect(screen.getByText('Загрузка модуля…')).toBeInTheDocument();
    expect(mocks.loadRemoteModule).toHaveBeenCalledWith('profile', 'App');

    pending.resolve(remoteModule);
    const view = await screen.findByTestId('remote-view');
    expect(view).toHaveAttribute('data-auth', 'true');
    expect(view).toHaveAttribute('data-completed', 'true');
  });

  it.each([
    ['Error', new Error('Failed to fetch dynamically imported module: http://localhost:3002/assets/remoteEntry.js profile/App')],
    ['TypeError', new TypeError('Failed to fetch dynamically imported module: http://localhost:3002/assets/remoteEntry.js profile/App')],
    ['string', 'http://localhost:3002/assets/remoteEntry.js profile/App'],
    ['object', { detail: 'http://localhost:3002/assets/remoteEntry.js profile/App' }],
  ])('shows only a generic notification when loading rejects with a %s', async (_label, rejection) => {
    mocks.loadRemoteModule.mockRejectedValue(rejection);
    render(<RemoteBoundary name="profile" module="App" auth={auth} />);

    expect(await screen.findByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('localhost:3002');
    expect(document.body.textContent).not.toContain('remoteEntry.js');
    expect(document.body.textContent).not.toContain('profile/App');
    expect(document.body.textContent).not.toContain('Failed to fetch');
  });

  it('does not inspect or stringify a rejected object', async () => {
    const rejection = {
      get toString() {
        throw new Error('must not be read');
      },
      get message() {
        throw new Error('must not be read');
      },
    };
    mocks.loadRemoteModule.mockRejectedValue(rejection);
    render(<RemoteBoundary name="profile" module="App" auth={auth} />);

    expect(await screen.findByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).toBeInTheDocument();
  });

  it('starts a new load after failure when the remote props change', async () => {
    const pending = deferred<RemoteModule>();
    mocks.loadRemoteModule.mockRejectedValueOnce(new Error('failed')).mockReturnValueOnce(pending.promise);
    const view = render(<RemoteBoundary name="profile" module="App" auth={auth} />);

    expect(await screen.findByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).toBeInTheDocument();
    view.rerender(<RemoteBoundary name="campaign" module="Home" auth={auth} />);

    expect(screen.getByText('Загрузка модуля…')).toBeInTheDocument();
    await waitFor(() => expect(mocks.loadRemoteModule).toHaveBeenCalledTimes(2));
    pending.resolve(remoteModule);
    expect(await screen.findByTestId('remote-view')).toBeInTheDocument();
    expect(screen.queryByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).not.toBeInTheDocument();
  });

  it('resets failure for changed props and ignores an obsolete rejection', async () => {
    const first = deferred<RemoteModule>();
    const second = deferred<RemoteModule>();
    mocks.loadRemoteModule.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = render(<RemoteBoundary name="profile" module="App" auth={auth} />);

    view.rerender(<RemoteBoundary name="campaign" module="Home" auth={auth} />);
    expect(screen.getByText('Загрузка модуля…')).toBeInTheDocument();
    await waitFor(() => expect(mocks.loadRemoteModule).toHaveBeenCalledTimes(2));

    second.resolve(remoteModule);
    expect(await screen.findByTestId('remote-view')).toBeInTheDocument();
    await act(async () => {
      first.reject(new Error('obsolete failure'));
    });

    expect(screen.queryByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).not.toBeInTheDocument();
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();
  });

  it('keeps explicit module retry after notification expiry and does not retry automatically', async () => {
    vi.useFakeTimers();
    let resolve!: (value: RemoteModule) => void;
    const pending = new Promise<RemoteModule>(done => { resolve = done; });
    mocks.loadRemoteModule.mockRejectedValueOnce(new Error('private module path')).mockReturnValueOnce(pending);
    const view = render(<RemoteBoundary name="profile" module="App" auth={auth} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить загрузку раздела' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText('Не удалось загрузить раздел. Попробуйте обновить страницу.')).toBeNull();
    expect(mocks.loadRemoteModule).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку раздела' }));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.loadRemoteModule).toHaveBeenCalledTimes(2);
    await act(async () => { resolve(remoteModule); await pending; });
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();
    view.unmount();
    vi.useRealTimers();
  });

  it('unmounts the old remote before rendering under a different parent route base', async () => {
    const pendingProfile = deferred<RemoteModule>();
    const renderLog: string[] = [];
    let oldRemoteUnmounted = 0;
    const CampaignHome: React.FC = () => {
      const location = useLocation();
      const [capturedLocation] = React.useState(location);
      const base = useResolvedPath('.').pathname;
      renderLog.push(`home:${base}`);
      React.useEffect(() => () => { oldRemoteUnmounted += 1; }, []);
      return <Routes location={capturedLocation}>
        <Route path="/" element={<div data-testid="campaign-home" />} />
      </Routes>;
    };
    const Profile: React.FC = () => <div data-testid="profile-view" />;
    const Navigation: React.FC = () => {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/profile')}>profile</button>;
    };
    mocks.loadRemoteModule.mockImplementation((name: string, module: string) => {
      if (name === 'campaign' && module === 'Home') return Promise.resolve({ default: CampaignHome });
      if (name === 'profile' && module === 'App') return pendingProfile.promise.then(() => ({ default: Profile }));
      return Promise.resolve(remoteModule);
    });

    const view = render(<MemoryRouter initialEntries={['/']}>
      <Navigation />
      <Routes>
        <Route path="/groups/*" element={<RemoteBoundary name="campaign" module="Home" auth={auth} />} />
        <Route path="/profile/*" element={<RemoteBoundary name="profile" module="App" auth={auth} />} />
        <Route path="/" element={<RemoteBoundary name="campaign" module="Home" auth={auth} />} />
      </Routes>
    </MemoryRouter>);

    expect(await screen.findByTestId('campaign-home')).toBeInTheDocument();
    fireEvent.click(view.getByRole('button', { name: 'profile' }));

    expect(await screen.findByText('Загрузка модуля…')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-home')).not.toBeInTheDocument();
    expect(oldRemoteUnmounted).toBe(1);
    expect(renderLog).not.toContain('home:/profile');
    await act(async () => pendingProfile.resolve(remoteModule));
    expect(await screen.findByTestId('profile-view')).toBeInTheDocument();
  });

  it.each([
    ['/groups/12/player/characters', 'campaign', 'App', '/profile'],
    ['/profile', 'profile', 'App', '/groups/12/player/characters'],
    ['/', 'campaign', 'Home', '/groups/12/player/characters'],
  ])('loads the new remote identity on navigation from %s to %s', async (origin, originName, originModule, destination) => {
    const next = deferred<RemoteModule>();
    const sourceUnmounts = vi.fn();
    const Source: React.FC = () => {
      const location = useLocation();
      const [acceptedLocation] = React.useState(location);
      React.useEffect(() => sourceUnmounts, []);
      return <Routes location={acceptedLocation}><Route path="*" element={<div data-testid="source-remote" />} /></Routes>;
    };
    const Destination: React.FC = () => <div data-testid="destination-remote" />;
    const Navigation: React.FC = () => {
      const navigate = useNavigate();
      return <button onClick={() => navigate(destination)}>navigate</button>;
    };
    const destinationName = destination.startsWith('/profile') ? 'profile' : 'campaign';
    const destinationModule = destination === '/profile' ? 'App' : destination.startsWith('/groups') ? 'App' : 'Home';
    mocks.loadRemoteModule.mockImplementation((name: string, module: string) => {
      if (name === originName && module === originModule) return Promise.resolve({ default: Source });
      if (name === destinationName && module === destinationModule) return next.promise.then(() => ({ default: Destination }));
      return Promise.resolve(remoteModule);
    });
    const element = (name: 'campaign' | 'profile', module: string) => <RemoteBoundary name={name} module={module} auth={auth} />;
    const view = render(<MemoryRouter initialEntries={[origin]}>
      <Navigation />
      <Routes>
        <Route path="/groups/*" element={element('campaign', 'App')} />
        <Route path="/profile/*" element={element('profile', 'App')} />
        <Route path="/" element={element('campaign', 'Home')} />
      </Routes>
    </MemoryRouter>);

    expect(await screen.findByTestId('source-remote')).toBeInTheDocument();
    fireEvent.click(view.getByRole('button', { name: 'navigate' }));
    expect(await screen.findByText('Загрузка модуля…')).toBeInTheDocument();
    expect(sourceUnmounts).toHaveBeenCalledTimes(1);
    await act(async () => next.resolve(remoteModule));
    expect(await screen.findByTestId('destination-remote')).toBeInTheDocument();
  });
});
