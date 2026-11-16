import { describe, expect, it, vi } from 'vitest';
import { bootstrap } from './bootstrap';

describe('Hub bootstrap', () => {
  it('loads configuration, registers remotes, then renders the app', async () => {
    const sequence: string[] = [];
    await bootstrap(
      async () => { sequence.push('config'); },
      () => { sequence.push('registered'); },
      () => { sequence.push('rendered'); },
      () => { sequence.push('failure'); },
    );
    expect(sequence).toEqual(['config', 'registered', 'rendered']);
  });

  it('renders safe failure without rendering the app when registration rejects', async () => {
    const renderApp = vi.fn();
    const renderFailure = vi.fn();
    await bootstrap(async () => {}, () => { throw new Error('private error'); }, renderApp, renderFailure);
    expect(renderApp).not.toHaveBeenCalled();
    expect(renderFailure).toHaveBeenCalledTimes(1);
  });

  it('keeps config load failures private and retries through registration before rendering', async () => {
    const sequence: string[] = [];
    const configError = new Error('private config failure');
    let attempts = 0;
    let finishRender!: () => void;
    const rendered = new Promise<void>((resolve) => { finishRender = resolve; });
    const load = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        sequence.push('config-rejected');
        throw configError;
      }
      sequence.push('config');
    });
    const configure = vi.fn(() => { sequence.push('registered'); });
    const renderApp = vi.fn(() => {
      sequence.push('rendered');
      finishRender();
    });
    const renderFailure = vi.fn();

    await bootstrap(load, configure, renderApp, renderFailure);

    expect(configure).not.toHaveBeenCalled();
    expect(renderApp).not.toHaveBeenCalled();
    expect(renderFailure).toHaveBeenCalledTimes(1);
    expect(renderFailure.mock.calls[0]).toHaveLength(1);
    expect(renderFailure.mock.calls[0][0]).toEqual(expect.any(Function));
    expect(renderFailure.mock.calls[0]).not.toContain(configError);

    renderFailure.mock.calls[0][0]();
    await rendered;
    expect(sequence).toEqual(['config-rejected', 'config', 'registered', 'rendered']);
  });
});
