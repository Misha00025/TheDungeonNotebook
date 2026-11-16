import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
  ])('shows only a generic alert when loading rejects with a %s', async (_label, rejection) => {
    mocks.loadRemoteModule.mockRejectedValue(rejection);
    render(<RemoteBoundary name="profile" module="App" auth={auth} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Не удалось загрузить раздел. Попробуйте обновить страницу.');
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить раздел. Попробуйте обновить страницу.');
  });

  it('starts a new load after failure when the remote props change', async () => {
    const pending = deferred<RemoteModule>();
    mocks.loadRemoteModule.mockRejectedValueOnce(new Error('failed')).mockReturnValueOnce(pending.promise);
    const view = render(<RemoteBoundary name="profile" module="App" auth={auth} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    view.rerender(<RemoteBoundary name="campaign" module="Home" auth={auth} />);

    expect(screen.getByText('Загрузка модуля…')).toBeInTheDocument();
    await waitFor(() => expect(mocks.loadRemoteModule).toHaveBeenCalledTimes(2));
    pending.resolve(remoteModule);
    expect(await screen.findByTestId('remote-view')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();
  });
});
