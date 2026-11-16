import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createBrowserConfig, readSettings, renderNginx, writeRuntimeFiles } from './generate.mjs';

const templatePath = new URL('./nginx.conf.template', import.meta.url);
const template = await readFile(templatePath, 'utf8');
const nginxQuote = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const settingsFor = (values = {}) => readSettings(values);

test('builds root-path settings and browser config without internal upstreams', () => {
  const settings = settingsFor({});
  assert.equal(settings.BASE_PATH, '/');
  assert.equal(settings.configPath, '/config.json');
  assert.deepEqual(createBrowserConfig(settings), {
    BFF_BASE: 'http://localhost:5080/bff',
    API_BASE: 'http://localhost:5080/bff/api',
    BASE_PATH: '/',
    REMOTES: {
      campaign: '/remotes/campaign/assets/remoteEntry.js',
      profile: '/remotes/profile/assets/remoteEntry.js',
      login: '/remotes/login/assets/remoteEntry.js',
    },
  });
  assert.doesNotMatch(JSON.stringify(createBrowserConfig(settings)), /campaign:3000|profile:3000|login:3000|hub:3000/);
});

test('normalizes custom base and remote paths into browser URLs', () => {
  const settings = settingsFor({
    WEB_BASE_PATH: '/notebook',
    WEB_CAMPAIGN_PATH: '/campaign-area',
    WEB_PROFILE_PATH: '/profile/',
    WEB_LOGIN_PATH: '/auth/sign-in/',
  });
  assert.equal(settings.BASE_PATH, '/notebook/');
  assert.equal(settings.configPath, '/notebook/config.json');
  assert.deepEqual(createBrowserConfig(settings).REMOTES, {
    campaign: '/notebook/campaign-area/assets/remoteEntry.js',
    profile: '/notebook/profile/assets/remoteEntry.js',
    login: '/notebook/auth/sign-in/assets/remoteEntry.js',
  });
  assert.doesNotThrow(() => settingsFor({ WEB_CAMPAIGN_PATH: '/shared/', WEB_PROFILE_PATH: '/shared/profile/' }));
});

test('canonicalizes spaces in base paths using the native URL pathname', () => {
  const settings = settingsFor({ WEB_BASE_PATH: '/the notebook' });
  const expected = `${new URL('/the notebook', 'http://runtime.invalid').pathname}/`;
  assert.equal(settings.BASE_PATH, expected);
  assert.equal(createBrowserConfig(settings).BASE_PATH, expected);
});

test('rejects invalid local paths and identical public remote paths', () => {
  for (const WEB_BASE_PATH of ['//host/path', '/notebook?x=1', '/notebook#part', '/a/../b', '/a/%2e%2e/b', '/bad%2']) {
    assert.throws(() => settingsFor({ WEB_BASE_PATH }), /Invalid WEB_BASE_PATH/);
  }
  for (const WEB_CAMPAIGN_PATH of ['/', '//host/', '/campaign/../profile/', '/campaign/%2e%2e/profile/', '/bad%2']) {
    assert.throws(() => settingsFor({ WEB_CAMPAIGN_PATH }), /Invalid WEB_CAMPAIGN_PATH/);
  }
  assert.throws(() => settingsFor({ WEB_CAMPAIGN_PATH: '/same/', WEB_PROFILE_PATH: '/same/' }), /collide/);
});

test('validates upstream origins while preserving relative API settings', () => {
  const settings = settingsFor({
    WEB_HUB_UPSTREAM: 'https://hub.internal/',
    WEB_CAMPAIGN_UPSTREAM: 'http://campaign.internal:8080',
    WEB_PROFILE_UPSTREAM: 'https://profile.internal',
    WEB_LOGIN_UPSTREAM: 'http://login.internal/',
    WEB_DNS_RESOLVER: '127.0.0.11 127.0.0.12',
    BFF_BASE: '/service/bff/',
    API_BASE: 'api/v1',
  });
  assert.deepEqual(settings.upstreams, {
    hub: 'https://hub.internal',
    campaign: 'http://campaign.internal:8080',
    profile: 'https://profile.internal',
    login: 'http://login.internal',
  });
  assert.equal(settings.resolver, '127.0.0.11 127.0.0.12');
  assert.equal(settings.BFF_BASE, '/service/bff');
  assert.equal(settings.API_BASE, 'api/v1');
  for (const WEB_HUB_UPSTREAM of ['ftp://hub.internal', 'http://user:pass@hub.internal', 'http://@hub.internal', 'http://hub$internal', 'http://hub.internal/path', 'http://hub.internal/?x=1', 'http://hub.internal/?', 'http://hub.internal/#']) {
    assert.throws(() => settingsFor({ WEB_HUB_UPSTREAM }), /Invalid WEB_HUB_UPSTREAM/);
  }
});

test('renders proxy locations, JSON alias, safe headers, and preserves Nginx variables', () => {
  const output = renderNginx(settingsFor({ WEB_BASE_PATH: '/notebook/' }), template);
  assert.ok(output.includes(`location = ${nginxQuote('/notebook/config.json')}`));
  assert.match(output, /alias \/app\/runtime\/config\.json;/);
  assert.match(output, /add_header Cache-Control "no-store" always;/);
  assert.ok(output.includes(`location ^~ ${nginxQuote('/notebook/remotes/campaign/')}`));
  assert.ok(output.includes(`rewrite ${nginxQuote('^/notebook/remotes/campaign/(.*)$')} /$1 break;`));
  assert.ok(output.includes(`rewrite ${nginxQuote('^/notebook/(.*)$')} /$1 break;`));
  assert.ok(output.includes(`sub_filter ${nginxQuote('<base href="/">')} ${nginxQuote('<base href="/notebook/">')};`));
  assert.match(output, /map \$http_x_forwarded_proto \$forwarded_proto/);
  assert.match(output, /default \$http_x_forwarded_proto;/);
  assert.match(output, /default \$http_x_forwarded_host;/);
  assert.match(output, /proxy_set_header Host \$http_host;/);
  assert.match(output, /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/);
  assert.match(output, /resolver "127\.0\.0\.11";/);
  assert.ok(output.includes(`return 308 "${'/notebook/'}$is_args$args";`));
  assert.match(output, /location \/ \{\s+return 404;/);
  assert.doesNotMatch(output, /error_page|try_files/);
});

test('renders root config without duplicate root locations or prefix redirect', () => {
  const output = renderNginx(settingsFor({}), template);
  assert.equal(output.split(`location ^~ ${nginxQuote('/')}`).length - 1, 1);
  assert.ok(!output.includes(`location = ${nginxQuote('/')}`));
  assert.doesNotMatch(output, /return 308/);
  assert.doesNotMatch(output, /location \/ \{\s+return 404;/);
});

test('escapes metacharacters and decodes URL-encoded paths for Nginx locations', () => {
  const output = renderNginx(settingsFor({
    WEB_BASE_PATH: '/notebook%20one/',
    WEB_CAMPAIGN_PATH: '/remote.a+b%20x/',
  }), template);
  const browserConfig = createBrowserConfig(settingsFor({
    WEB_BASE_PATH: '/notebook%20one/',
    WEB_CAMPAIGN_PATH: '/remote.a+b%20x/',
  }));
  assert.ok(output.includes(`location ^~ ${nginxQuote('/notebook one/remote.a+b x/')}`));
  assert.ok(output.includes(`rewrite ${nginxQuote('^/notebook one/remote\\.a\\+b x/(.*)$')} /$1 break;`));
  assert.ok(output.includes(nginxQuote('<base href="/notebook%20one/">')));
  assert.equal(browserConfig.REMOTES.campaign, '/notebook%20one/remote.a+b%20x/assets/remoteEntry.js');
});

test('escapes Nginx literal metacharacters and rejects line breaks in paths', () => {
  const settings = settingsFor({ WEB_CAMPAIGN_PATH: '/remote%22$/' });
  const output = renderNginx(settings, template);
  assert.ok(output.includes(`location ^~ ${nginxQuote('/remote"$/')}`));
  assert.equal(createBrowserConfig(settings).REMOTES.campaign, '/remote%22%24/assets/remoteEntry.js');
  assert.ok(output.includes(`rewrite ${nginxQuote('^/remote"\\$/(.*)$')} /$1 break;`));
  assert.throws(() => settingsFor({ WEB_CAMPAIGN_PATH: '/remote/\r\nlocation/' }), /Invalid WEB_CAMPAIGN_PATH/);
  assert.throws(() => renderNginx({ ...settings, resolver: '127.0.0.11\ninvalid' }, template), /Invalid Nginx value/);
});

test('keeps dollar and space paths encoded in HTML and redirect output', () => {
  const settings = settingsFor({ WEB_BASE_PATH: '/notebook$ space/' });
  const output = renderNginx(settings, template);
  const config = createBrowserConfig(settings);
  assert.equal(config.BASE_PATH, '/notebook%24%20space/');
  assert.equal(config.REMOTES.campaign, '/notebook%24%20space/remotes/campaign/assets/remoteEntry.js');
  assert.ok(output.includes(`sub_filter ${nginxQuote('<base href="/">')} ${nginxQuote('<base href="/notebook%24%20space/">')};`));
  assert.ok(output.includes('return 308 "/notebook%24%20space/$is_args$args";'));
});

test('writes runtime config and Nginx config to caller-provided paths', async () => {
  const directory = await mkdtemp('/tmp/opencode/web-proxy-');
  try {
    const browserConfigPath = path.join(directory, 'runtime', 'config.json');
    const nginxConfigPath = path.join(directory, 'nginx', 'default.conf');
    await writeRuntimeFiles(settingsFor({}), {
      templatePath,
      browserConfigPath,
      nginxConfigPath,
    });
    const rootNginx = await readFile(nginxConfigPath, 'utf8');
    const firstConfig = await readFile(browserConfigPath, 'utf8');
    await writeRuntimeFiles(settingsFor({ WEB_BASE_PATH: '/second/' }), {
      templatePath,
      browserConfigPath,
      nginxConfigPath,
    });
    const secondNginx = await readFile(nginxConfigPath, 'utf8');
    const secondConfig = await readFile(browserConfigPath, 'utf8');
    assert.ok(rootNginx.includes(`location ^~ ${nginxQuote('/')}`));
    assert.match(firstConfig, /"BASE_PATH": "\/"/);
    assert.ok(secondNginx.includes(`location ^~ ${nginxQuote('/second/')}`));
    assert.match(secondConfig, /"BASE_PATH": "\/second\/"/);
    assert.equal(await readFile(templatePath, 'utf8'), template);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
