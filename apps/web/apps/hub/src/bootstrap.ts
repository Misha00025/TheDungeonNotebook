export async function bootstrap(
  load: () => Promise<void>,
  configure: () => void,
  renderApp: () => void,
  renderFailure: (retry: () => void) => void,
): Promise<void> {
  try {
    await load();
    configure();
    renderApp();
  } catch {
    renderFailure(() => void bootstrap(load, configure, renderApp, renderFailure));
  }
}
