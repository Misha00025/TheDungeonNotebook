import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRemoteEntry } from './check-remote-assets.mjs';

const fixture = ({ js = './component.js', css = './style.css' } = {}) => `
export async function get(name) {
  await import(${JSON.stringify(js)});
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ${JSON.stringify(css)};
  document.head.appendChild(link);
  return { name };
}
`;

const availableAssets = new Set(['assets/component.js', 'assets/style.css']);
const assetExists = async (relativeFilePath) => availableAssets.has(relativeFilePath);

test('validates relative JS and CSS assets under root, prefixed, and no-dot origins', async () => {
  for (const remoteBaseUrl of [
    'https://assets-check.invalid/remotes/profile/',
    'https://assets-check.invalid/notebook/remotes/profile/',
    'http://localhost:3004/remotes/profile/',
  ]) {
    const checked = [];
    const references = await validateRemoteEntry({
      source: fixture(),
      remoteBaseUrl,
      exposedModules: ['./App'],
      assetExists: async (relativeFilePath) => {
        checked.push(relativeFilePath);
        return availableAssets.has(relativeFilePath);
      },
    });
    assert.deepEqual(references.map(({ kind, relativeFilePath }) => [kind, relativeFilePath]), [
      ['js', 'assets/component.js'],
      ['css', 'assets/style.css'],
    ]);
    assert.deepEqual(checked, ['assets/component.js', 'assets/style.css']);
  }
});

test('rejects a relative JS path that resolves below assets/assets', async () => {
  await assert.rejects(validateRemoteEntry({
    source: fixture({ js: './assets/component.js' }),
    remoteBaseUrl: 'https://assets-check.invalid/notebook/remotes/login/',
    exposedModules: ['./App'],
    assetExists,
  }), /assets\/assets\/component\.js/);
});

test('rejects a missing CSS file beneath the nested assets path', async () => {
  await assert.rejects(validateRemoteEntry({
    source: fixture({ css: './assets/style.css' }),
    remoteBaseUrl: 'https://assets-check.invalid/remotes/campaign/',
    exposedModules: ['./App'],
    assetExists,
  }), /assets\/assets\/style\.css/);
});

test('rejects root-absolute assets that escape the public remote prefix', async () => {
  await assert.rejects(validateRemoteEntry({
    source: fixture({ js: '/assets/component.js' }),
    remoteBaseUrl: 'https://assets-check.invalid/notebook/remotes/profile/',
    exposedModules: ['./App'],
    assetExists,
  }), /escapes https:\/\/assets-check\.invalid\/notebook\/remotes\/profile\//);
});

test('rejects references whose resolved file is absent from the build', async () => {
  await assert.rejects(validateRemoteEntry({
    source: fixture(),
    remoteBaseUrl: 'http://localhost:3004/remotes/login/',
    exposedModules: ['./App'],
    assetExists: async () => false,
  }), /Missing remote js asset .*build file assets\/component\.js/);
});
