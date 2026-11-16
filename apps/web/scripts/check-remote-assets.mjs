import { readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const remoteModules = {
  campaign: ['./App', './Home', './CompleteProfile'],
  profile: ['./App'],
  login: ['./App'],
};

function vmApiError() {
  if (typeof SourceTextModule !== 'function' || typeof SyntheticModule !== 'function') {
    throw new Error('Node VM modules are unavailable; run with --experimental-vm-modules');
  }
}

export async function validateRemoteEntry({ source, remoteBaseUrl, exposedModules, assetExists }) {
  vmApiError();
  if (typeof assetExists !== 'function') throw new TypeError('assetExists must be a function');

  const remoteBase = new URL(remoteBaseUrl);
  if (!remoteBase.pathname.endsWith('/')) throw new Error(`Remote base URL must end with a slash: ${remoteBase.href}`);
  const entryUrl = new URL('assets/remoteEntry.js', remoteBase);
  const jsReferences = [];
  const cssReferences = [];
  const syntheticModules = new Map();
  const mockDocument = {
    createElement: (tagName) => ({ tagName: String(tagName).toUpperCase() }),
    querySelector: () => null,
    head: {
      querySelector: () => null,
      appendChild: (element) => {
        if (element.tagName === 'LINK' && typeof element.href === 'string') cssReferences.push(element.href);
        return element;
      },
    },
  };
  const context = createContext({ document: mockDocument, window: {}, URL, console });

  const resolveReference = (specifier, referencingModule, kind) => {
    let url;
    try {
      url = new URL(specifier, referencingModule.identifier);
    } catch {
      throw new Error(`Invalid ${kind} reference from ${referencingModule.identifier}: ${specifier}`);
    }
    if (kind === 'js') jsReferences.push(url.href);
    return url;
  };

  const getSyntheticModule = (url) => {
    let module = syntheticModules.get(url.href);
    if (!module) {
      module = new SyntheticModule(['default'], function setDefaultExport() {
        this.setExport('default', () => undefined);
      }, { context, identifier: url.href });
      syntheticModules.set(url.href, module);
    }
    return module;
  };

  const entryModule = new SourceTextModule(source, {
    context,
    identifier: entryUrl.href,
    initializeImportMeta: (meta) => { meta.url = entryUrl.href; },
    importModuleDynamically: async (specifier, referencingModule) => {
      const url = resolveReference(specifier, referencingModule, 'js');
      const module = getSyntheticModule(url);
      if (module.status === 'unlinked') await module.link(() => { throw new Error('Unexpected nested synthetic import'); });
      if (module.status === 'linked') await module.evaluate();
      return module;
    },
  });

  await entryModule.link((specifier, referencingModule) => {
    const url = resolveReference(specifier, referencingModule, 'js');
    return getSyntheticModule(url);
  });
  await entryModule.evaluate();

  for (const exposedModule of exposedModules) {
    const get = entryModule.namespace.get;
    if (typeof get !== 'function') throw new Error(`Remote entry does not expose get() for ${entryUrl.href}`);
    await get(exposedModule);
  }

  const references = [
    ...jsReferences.map((url) => ({ kind: 'js', url })),
    ...cssReferences.map((specifier) => ({ kind: 'css', url: new URL(specifier, entryUrl).href })),
  ];

  for (const reference of references) {
    const url = new URL(reference.url);
    if (url.origin !== remoteBase.origin || !url.pathname.startsWith(remoteBase.pathname)) {
      throw new Error(`Remote ${reference.kind} reference escapes ${remoteBase.href}: ${url.href}`);
    }
    let relativeFilePath;
    try {
      relativeFilePath = decodeURIComponent(url.pathname.slice(remoteBase.pathname.length));
    } catch {
      throw new Error(`Invalid asset path in ${reference.url}`);
    }
    if (!relativeFilePath || relativeFilePath.startsWith('/') || relativeFilePath.split('/').includes('..')) {
      throw new Error(`Remote ${reference.kind} reference escapes the build directory: ${url.href}`);
    }
    reference.relativeFilePath = relativeFilePath;
    if (!await assetExists(relativeFilePath)) {
      throw new Error(`Missing remote ${reference.kind} asset ${url.href} (build file ${relativeFilePath})`);
    }
  }

  return references;
}

async function fileExists(buildDirectory, relativeFilePath) {
  const filePath = resolve(buildDirectory, relativeFilePath);
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function runCli() {
  if (typeof SourceTextModule !== 'function' || typeof SyntheticModule !== 'function') vmApiError();
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !Object.hasOwn(remoteModules, args[0]))) {
    throw new Error('Usage: node --experimental-vm-modules check-remote-assets.mjs [campaign|profile|login]');
  }

  const names = args.length ? args : Object.keys(remoteModules);
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  for (const name of names) {
    const buildDirectory = resolve(scriptDirectory, `../apps/${name}/build`);
    const entryPath = resolve(buildDirectory, 'assets/remoteEntry.js');
    const source = await readFile(entryPath, 'utf8');
    let validatedReferenceCount = 0;
    for (const remoteBaseUrl of [
      `https://assets-check.invalid/remotes/${name}/`,
      `https://assets-check.invalid/notebook/remotes/${name}/`,
      `http://localhost:3004/remotes/${name}/`,
    ]) {
      const references = await validateRemoteEntry({
        source,
        remoteBaseUrl,
        exposedModules: remoteModules[name],
        assetExists: (relativeFilePath) => fileExists(buildDirectory, relativeFilePath),
      });
      validatedReferenceCount += references.length;
    }
    process.stdout.write(`${name}: validated ${validatedReferenceCount} JS/CSS references across 3 public bases\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
