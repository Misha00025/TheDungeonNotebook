import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const remoteNames = ['campaign', 'profile', 'login'];
const defaultBff = 'http://localhost:5080/bff';

function localPath(value, label, allowRoot) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[?#\\\r\n]/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error(`Invalid ${label}`);
  }
  if (decoded.split('/').some((part) => part === '.' || part === '..')) throw new Error(`Invalid ${label}`);
  const path = value === '/' ? '/' : value.replace(/\/+$/, '');
  if (!path && !allowRoot) throw new Error(`Invalid ${label}`);
  let parsed;
  try {
    parsed = new URL(path || '/', 'http://runtime.invalid');
  } catch {
    throw new Error(`Invalid ${label}`);
  }
  if (parsed.origin !== 'http://runtime.invalid' || parsed.search || parsed.hash) {
    throw new Error(`Invalid ${label}`);
  }
  const canonicalPath = parsed.pathname.replace(/\$/g, '%24');
  return canonicalPath === '/' ? '/' : `${canonicalPath}/`;
}

function upstreamOrigin(value, label) {
  let url;
  try {
    if (typeof value !== 'string' || /[\r\n?#]/.test(value)) throw new Error();
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /^https?:\/\/[^/]*@/i.test(value) || !['', '/'].includes(url.pathname) || url.search || url.hash || url.origin.includes('$')) {
    throw new Error(`Invalid ${label}`);
  }
  return url.origin;
}

function publicPath(basePath, suffix) {
  return `${basePath === '/' ? '' : basePath.slice(0, -1)}${suffix}`;
}

export function readSettings(env) {
  const basePath = localPath(env.WEB_BASE_PATH || '/', 'WEB_BASE_PATH', true);
  const routes = {};
  for (const name of remoteNames) {
    const suffix = localPath(env[`WEB_${name.toUpperCase()}_PATH`] || `/remotes/${name}/`, `WEB_${name.toUpperCase()}_PATH`, false);
    if (suffix === '/') throw new Error(`Invalid WEB_${name.toUpperCase()}_PATH`);
    routes[name] = { suffix, path: publicPath(basePath, suffix) };
  }
  const configPath = publicPath(basePath, '/config.json');
  const nginxPaths = [...remoteNames.map((name) => decodeURIComponent(routes[name].path)), decodeURIComponent(configPath)];
  if (new Set(nginxPaths).size !== nginxPaths.length) throw new Error('Remote or config paths collide');

  const bffBase = (env.BFF_BASE || defaultBff).replace(/\/+$/, '') || '/';
  const apiBase = env.API_BASE || `${bffBase === '/' ? '' : bffBase}/api`;
  return {
    BFF_BASE: bffBase,
    API_BASE: apiBase,
    BASE_PATH: basePath,
    configPath,
    remotes: routes,
    upstreams: {
      hub: upstreamOrigin(env.WEB_HUB_UPSTREAM || 'http://hub:3000', 'WEB_HUB_UPSTREAM'),
      campaign: upstreamOrigin(env.WEB_CAMPAIGN_UPSTREAM || 'http://campaign:3000', 'WEB_CAMPAIGN_UPSTREAM'),
      profile: upstreamOrigin(env.WEB_PROFILE_UPSTREAM || 'http://profile:3000', 'WEB_PROFILE_UPSTREAM'),
      login: upstreamOrigin(env.WEB_LOGIN_UPSTREAM || 'http://login:3000', 'WEB_LOGIN_UPSTREAM'),
    },
    resolver: env.WEB_DNS_RESOLVER || '127.0.0.11',
  };
}

export function createBrowserConfig(settings) {
  return {
    BFF_BASE: settings.BFF_BASE,
    API_BASE: settings.API_BASE,
    BASE_PATH: settings.BASE_PATH,
    REMOTES: Object.fromEntries(remoteNames.map((name) => [name, `${settings.remotes[name].path}assets/remoteEntry.js`])),
  };
}

function nginxQuote(value) {
  if (/[\r\n]/.test(value)) throw new Error('Invalid Nginx value');
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function nginxQuoteWithSuffix(value, suffix) {
  if (/[\r\n]/.test(value) || /[\r\n"]/.test(suffix)) throw new Error('Invalid Nginx value');
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}${suffix}"`;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function htmlEscape(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function locationPath(path) {
  return decodeURIComponent(path);
}

function renderRemoteLocations(settings) {
  return remoteNames.map((name) => {
    const path = locationPath(settings.remotes[name].path);
    const regex = `^${regexEscape(path)}(.*)$`;
    return [
      `location ^~ ${nginxQuote(path)} {`,
      `    rewrite ${nginxQuote(regex)} /$1 break;`,
      `    proxy_pass $${name}_upstream;`,
      '}',
    ].join('\n');
  }).join('\n\n');
}

function renderBaseRedirect(settings) {
  if (settings.BASE_PATH === '/') return '';
  const base = locationPath(settings.BASE_PATH);
  const redirectPath = settings.BASE_PATH;
  return [
    `location = ${nginxQuote(base.slice(0, -1))} {`,
    `    return 308 ${nginxQuoteWithSuffix(redirectPath, '$is_args$args')};`,
    '}',
  ].join('\n');
}

export function renderNginx(settings, template) {
  if (/[\r\n]/.test(settings.resolver)) throw new Error('Invalid Nginx value');
  const base = locationPath(settings.BASE_PATH);
  const configPath = locationPath(settings.configPath);
  const baseRegex = `^${regexEscape(base)}(.*)$`;
  const outsideBase = settings.BASE_PATH === '/'
    ? ''
    : ['location / {', '    return 404;', '}'].join('\n');
  const replacements = {
    '@@RESOLVER@@': settings.resolver.trim().split(/\s+/).map(nginxQuote).join(' '),
    '@@HUB_UPSTREAM@@': nginxQuote(settings.upstreams.hub),
    '@@CAMPAIGN_UPSTREAM@@': nginxQuote(settings.upstreams.campaign),
    '@@PROFILE_UPSTREAM@@': nginxQuote(settings.upstreams.profile),
    '@@LOGIN_UPSTREAM@@': nginxQuote(settings.upstreams.login),
    '@@CONFIG_PATH@@': nginxQuote(configPath),
    '@@REMOTE_LOCATIONS@@': renderRemoteLocations(settings),
    '@@BASE_REDIRECT@@': renderBaseRedirect(settings),
    '@@BASE_PATH@@': nginxQuote(base),
    '@@BASE_REWRITE@@': nginxQuote(baseRegex),
    '@@BASE_HTML_OLD@@': nginxQuote('<base href="/">'),
    '@@BASE_HTML_NEW@@': nginxQuote(`<base href="${htmlEscape(settings.BASE_PATH)}">`),
    '@@OUTSIDE_BASE@@': outsideBase,
  };
  let output = template;
  for (const [token, value] of Object.entries(replacements)) output = output.replaceAll(token, () => value);
  return output;
}

export async function writeRuntimeFiles(settings, paths) {
  const template = await readFile(paths.templatePath, 'utf8');
  const browserConfig = createBrowserConfig(settings);
  const nginxConfig = renderNginx(settings, template);
  await Promise.all([
    mkdir(dirname(paths.browserConfigPath), { recursive: true }),
    mkdir(dirname(paths.nginxConfigPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(paths.browserConfigPath, `${JSON.stringify(browserConfig, null, 2)}\n`),
    writeFile(paths.nginxConfigPath, nginxConfig),
  ]);
}

async function run() {
  const appDir = '/app';
  const settings = readSettings(process.env);
  await writeRuntimeFiles(settings, {
    templatePath: `${appDir}/nginx.conf.template`,
    browserConfigPath: `${appDir}/runtime/config.json`,
    nginxConfigPath: '/etc/nginx/conf.d/default.conf',
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await run();
