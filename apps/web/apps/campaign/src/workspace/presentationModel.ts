import type { FieldReference, JsonValue, Presentation, Revision, ViewNode, WidgetNode } from './types';
import { parseJson, stringifyJson } from './json';
import { isLosslessNumber } from 'lossless-json';

export type PresentationNode = { kind: 'layout'; nodeKey: string; title: string; params: JsonValue; children: PresentationNode[] };
export type PresentationType = 'group' | 'composite' | 'resource' | 'stat-list';
export type JsonFieldReference = { kind: FieldReference['kind']; fieldId: string; [key: string]: JsonValue };
export type FieldPart = { text: string } | { source: JsonFieldReference; signed?: boolean };
export type PresentationParams =
  | { version: 1; type: 'group'; direction: 'row' | 'column'; columns: number; gap: 'small' | 'medium' | 'large'; appearance: 'plain' | 'panel'; [key: string]: JsonValue }
  | { version: 1; type: 'composite'; parts: FieldPart[]; primary: JsonFieldReference | null; [key: string]: JsonValue }
  | { version: 1; type: 'resource'; current: JsonFieldReference | null; maximum: JsonFieldReference | null; showBar: boolean; [key: string]: JsonValue }
  | { version: 1; type: 'stat-list'; entries: { source: JsonFieldReference; label: string; [key: string]: JsonValue }[]; columns: number; [key: string]: JsonValue };
export type ParamsRead = { [T in PresentationType]: { status: 'supported'; type: T; params: Extract<PresentationParams, { type: T }> } }[PresentationType] | { status: 'unsupported' | 'invalid'; message: string; params: JsonValue };

const isRecord = (value: unknown): value is Record<string, JsonValue> => typeof value === 'object' && value !== null && !Array.isArray(value) && !isLosslessNumber(value);
const positiveInteger = (value: JsonValue | undefined): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
type ReferenceShape = { kind: FieldReference['kind']; fieldId: string };
const validRef = (value: unknown): value is ReferenceShape => isRecord(value) && (value.kind === 'Base' || value.kind === 'Virtual') && typeof value.fieldId === 'string';
const validPart = (value: JsonValue): value is FieldPart => isRecord(value) && (typeof value.text === 'string' || validRef(value.source) && (value.signed === undefined || typeof value.signed === 'boolean'));

export function readParams(params: JsonValue): ParamsRead {
  if (!isRecord(params) || params.type === undefined) {
    const legacy = isRecord(params) ? params : {};
    const legacyParams = {
      ...legacy,
      version: 1,
      type: 'group',
      direction: legacy.direction === 'row' || legacy.direction === 'column' ? legacy.direction : 'column',
      columns: positiveInteger(legacy.columns) ? legacy.columns : 1,
      gap: legacy.gap === 'small' || legacy.gap === 'medium' || legacy.gap === 'large' ? legacy.gap : 'medium',
      appearance: legacy.appearance === 'plain' || legacy.appearance === 'panel' ? legacy.appearance : 'plain',
    };
    return { status: 'supported', type: 'group', params: legacyParams as Extract<PresentationParams, { type: 'group' }> };
  }
  if (params.legacyFormatError === true) return { status: 'invalid', message: 'Формат старого виджета не удалось распознать.', params };
  const type = params.type === undefined ? 'group' : params.type;
  if (type !== 'group' && type !== 'composite' && type !== 'resource' && type !== 'stat-list') return { status: 'unsupported', message: 'Тип отображения не поддерживается.', params };
  if (params.version !== undefined && params.version !== 1) return { status: 'unsupported', message: 'Версия настроек не поддерживается.', params };
  const valid = type === 'group'
    ? (params.direction === 'row' || params.direction === 'column') && positiveInteger(params.columns) && (params.gap === 'small' || params.gap === 'medium' || params.gap === 'large') && (params.appearance === 'plain' || params.appearance === 'panel')
    : type === 'composite'
      ? Array.isArray(params.parts) && params.parts.every(validPart) && (params.primary === null || validRef(params.primary) && params.primary.kind === 'Base')
      : type === 'resource'
        ? (params.current === null || validRef(params.current)) && (params.maximum === null || validRef(params.maximum)) && typeof params.showBar === 'boolean'
        : Array.isArray(params.entries) && params.entries.every(entry => isRecord(entry) && validRef(entry.source) && typeof entry.label === 'string') && positiveInteger(params.columns);
  return valid ? { status: 'supported', type, params: { ...params, version: 1, type } as PresentationParams } as ParamsRead : { status: 'invalid', message: 'Настройки отображения заполнены некорректно.', params };
}

const stringParam = (value: JsonValue | undefined, fallback: string): string => typeof value === 'string' ? value : fallback;
export const makeNode = (type: PresentationType, title = ''): PresentationNode => ({
  kind: 'layout', nodeKey: crypto.randomUUID(), title, children: [],
  params: type === 'group'
    ? { version: 1, type, direction: 'column', columns: 1, gap: 'medium', appearance: 'plain' }
    : type === 'composite' ? { version: 1, type, parts: [], primary: null }
      : type === 'resource' ? { version: 1, type, current: null, maximum: null, showBar: true }
        : { version: 1, type, entries: [], columns: 1 },
});

function parseWidgetFormat(format: string, sources: WidgetNode['sources']): FieldPart[] | null {
  const parts: FieldPart[] = [];
  let literal = '';
  for (let cursor = 0; cursor < format.length;) {
    if (format[cursor] !== '$') { literal += format[cursor++]; continue; }
    if (format.startsWith('$$', cursor)) { literal += '$'; cursor += 2; continue; }
    const token = /^\$(\d+)|^\$\{(\d+):s\}/.exec(format.slice(cursor));
    if (!token) return null;
    if (literal) { parts.push({ text: literal }); literal = ''; }
    const index = Number(token[1] ?? token[2]);
    const source = sources[index - 1];
    if (!Number.isSafeInteger(index) || index < 1 || !source) return null;
    parts.push({ source: { kind: source.kind, fieldId: source.fieldId }, ...(token[2] ? { signed: true } : {}) });
    cursor += token[0].length;
  }
  if (literal) parts.push({ text: literal });
  return parts;
}

function normalizeNode(node: ViewNode): PresentationNode {
  if (node.kind === 'layout') return { kind: 'layout', nodeKey: node.nodeKey, title: node.title, params: node.params, children: node.children.map(normalizeNode) };
  const parsed = parseWidgetFormat(node.format, node.sources);
  const params: JsonValue = {
    ...(isRecord(node.params) ? node.params : { legacyParams: node.params }),
    version: 1,
    type: 'composite',
    parts: parsed ?? [],
    primary: null,
    ...(!parsed ? { legacyFormatError: true } : {}),
    legacyWidget: { params: node.params, sources: node.sources as unknown as JsonValue, format: node.format },
  };
  return { kind: 'layout', nodeKey: node.nodeKey, title: node.title, params, children: node.children.map(normalizeNode) };
}
export const normalizeRoots = (wire: ViewNode[]): PresentationNode[] => wire.map(normalizeNode);

export const patchNodeParams = (node: PresentationNode, patch: Record<string, JsonValue>): PresentationNode => {
  const existing = isRecord(node.params) ? node.params : { legacyParams: node.params };
  return { ...node, params: { ...existing, ...patch } };
};
export const findNode = (roots: PresentationNode[], nodeKey: string): PresentationNode | undefined => {
  for (const node of roots) { if (node.nodeKey === nodeKey) return node; const found = findNode(node.children, nodeKey); if (found) return found; }
  return undefined;
};
export const updateNode = (roots: PresentationNode[], nodeKey: string, update: (node: PresentationNode) => PresentationNode): PresentationNode[] => {
  let changed = false;
  const next = roots.map(node => {
    if (node.nodeKey === nodeKey) {
      const updated = update(node);
      changed ||= updated !== node;
      return updated;
    }
    const children = updateNode(node.children, nodeKey, update);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : roots;
};
export type NodePosition = { parentKey: string | null; index: number };
const locate = (roots: PresentationNode[], key: string, parentKey: string | null = null): NodePosition | undefined => {
  for (let index = 0; index < roots.length; index++) { if (roots[index].nodeKey === key) return { parentKey, index }; const found = locate(roots[index].children, key, roots[index].nodeKey); if (found) return found; }
  return undefined;
};
const removeNode = (roots: PresentationNode[], key: string): { roots: PresentationNode[]; node?: PresentationNode } => {
  const found = roots.find(node => node.nodeKey === key);
  if (found) return { roots: roots.filter(node => node.nodeKey !== key), node: found };
  let removed: PresentationNode | undefined;
  let changed = false;
  const next = roots.map(node => { const result = removeNode(node.children, key); removed ??= result.node; if (!result.node) return node; changed = true; return { ...node, children: result.roots }; });
  return { roots: changed ? next : roots, get node() { return removed; } };
};
export const insertNode = (roots: PresentationNode[], node: PresentationNode, parentKey: string | null = null, index?: number): PresentationNode[] => {
  if (parentKey === null) { const next = [...roots]; next.splice(Math.max(0, Math.min(index ?? next.length, next.length)), 0, node); return next; }
  const parent = findNode(roots, parentKey);
  const parentParams = parent ? readParams(parent.params) : undefined;
  if (!parent || parentParams?.status !== 'supported' || parentParams.type !== 'group') return roots;
  return updateNode(roots, parentKey, parent => ({ ...parent, children: insertNode(parent.children, node, null, index) }));
};
export const removeTreeNode = (roots: PresentationNode[], nodeKey: string): PresentationNode[] => removeNode(roots, nodeKey).roots;
const remapKeys = (node: PresentationNode): PresentationNode => ({ ...node, nodeKey: crypto.randomUUID(), children: node.children.map(remapKeys) });
export const duplicateNode = (roots: PresentationNode[], nodeKey: string): PresentationNode[] => {
  const position = locate(roots, nodeKey); const original = findNode(roots, nodeKey);
  return position && original ? insertNode(roots, remapKeys(original), position.parentKey, position.index + 1) : roots;
};
export const moveNode = (roots: PresentationNode[], nodeKey: string, parentKey: string | null, index: number): PresentationNode[] => {
  const node = findNode(roots, nodeKey);
  if (!node || nodeKey === parentKey || (parentKey !== null && !findNode(roots, parentKey)) || (parentKey && findNode(node.children, parentKey))) return roots;
  if (parentKey !== null) {
    const parentParams = readParams(findNode(roots, parentKey)!.params);
    if (parentParams.status !== 'supported' || parentParams.type !== 'group') return roots;
  }
  const old = locate(roots, nodeKey)!;
  let targetIndex = index;
  if (old.parentKey === parentKey && old.index < index) targetIndex--;
  const targetSiblings = parentKey === null ? roots : findNode(roots, parentKey)!.children;
  const effectiveIndex = Math.max(0, Math.min(targetIndex, targetSiblings.length - (old.parentKey === parentKey ? 1 : 0)));
  if (old.parentKey === parentKey && effectiveIndex === old.index) return roots;
  let next = removeTreeNode(roots, nodeKey);
  return insertNode(next, node, parentKey, targetIndex);
};
export const moveSibling = (roots: PresentationNode[], nodeKey: string, direction: 'before' | 'after', siblingKey: string): PresentationNode[] => {
  const sibling = locate(roots, siblingKey);
  return sibling ? moveNode(roots, nodeKey, sibling.parentKey, sibling.index + (direction === 'after' ? 1 : 0)) : roots;
};

export type PresentationPage = { key: string; title: string; viewKey: string; order?: number; [key: string]: JsonValue | undefined };
export const isPageKey = (key: string): boolean => /^page_[1-9]\d*$/.test(key);
const suffix = (key: string) => BigInt(key.slice(5));
const contextObject = (value: JsonValue | undefined): Record<string, JsonValue> => isRecord(value) ? value : {};
export function readPages(presentation: Presentation): PresentationPage[] {
  return Object.entries(presentation.defaults).filter(([key]) => isPageKey(key)).map(([key, viewKey]) => {
    const rawContext = presentation.contextParams[key];
    const context = isRecord(rawContext) ? rawContext : rawContext === undefined ? {} : { legacyParams: rawContext };
    const order = positiveInteger(context.order) ? context.order : undefined;
    const numericTitle = suffix(key).toString();
    return { ...context, key, title: stringParam(context.title, `Страница ${numericTitle}`), viewKey, ...(order ? { order } : {}) } as PresentationPage;
  }).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (suffix(a.key) < suffix(b.key) ? -1 : suffix(a.key) > suffix(b.key) ? 1 : 0));
}
export const addPageKey = (presentation: Presentation): string => {
  const keys = [...Object.keys(presentation.defaults), ...Object.keys(presentation.contextParams)].filter(isPageKey);
  const max = keys.reduce((highest, key) => suffix(key) > highest ? suffix(key) : highest, 0n);
  return `page_${max + 1n}`;
};
export function writePages(original: Presentation, pages: PresentationPage[]): Presentation {
  const defaults = Object.fromEntries(Object.entries(original.defaults).filter(([key]) => !isPageKey(key)));
  const contextParams = Object.fromEntries(Object.entries(original.contextParams).filter(([key]) => !isPageKey(key)));
  pages.forEach((page, index) => {
    defaults[page.key] = page.viewKey;
    const rawExisting = original.contextParams[page.key];
    const existing = isRecord(rawExisting) ? rawExisting : rawExisting === undefined ? {} : { legacyParams: rawExisting };
    const extra = Object.fromEntries(Object.entries(page).filter(([key]) => !['key', 'title', 'viewKey', 'order'].includes(key) && key !== 'undefined'));
    contextParams[page.key] = { ...existing, ...extra, title: page.title, order: index + 1 };
  });
  return { ...original, defaults, contextParams };
}

export type LocalDraftScope = { account: string; campaign: string; view: string; schemaVersion: number };
export type LocalDraft = LocalDraftScope & { roots: PresentationNode[]; name: string; baseContentRevision: Revision; baseMetadataRevision: Revision };
export type DraftRead = { status: 'ok'; draft: LocalDraft } | { status: 'error'; message: string };
export const localDraftKey = (scope: LocalDraftScope): string => `tdn:presentation-draft:${encodeURIComponent(scope.account)}:${encodeURIComponent(scope.campaign)}:${encodeURIComponent(scope.view)}:${scope.schemaVersion}`;
export const stringifyDraft = (draft: LocalDraft): string => stringifyJson({
  account: draft.account,
  campaign: draft.campaign,
  view: draft.view,
  schemaVersion: draft.schemaVersion,
  roots: draft.roots,
  name: draft.name,
  baseContentRevision: draft.baseContentRevision,
  baseMetadataRevision: draft.baseMetadataRevision,
});
export function parseDraft(text: string, scope: LocalDraftScope): DraftRead {
  try {
    const value = parseJson(text);
    if (!isRecord(value) || value.account !== scope.account || value.campaign !== scope.campaign || value.view !== scope.view || value.schemaVersion !== 1 || scope.schemaVersion !== 1 || !Array.isArray(value.roots) || typeof value.name !== 'string' || !positiveRevision(value.baseContentRevision) || !positiveRevision(value.baseMetadataRevision)) return { status: 'error', message: 'Черновик имеет неверный формат или принадлежит другому отображению.' };
    const nodeKeys = new Set<string>();
    const roots = value.roots.map(projectDraftNode);
    if (roots.some(root => !root) || !roots.every(root => root && collectUniqueNodeKeys(root, nodeKeys))) return { status: 'error', message: 'Черновик имеет неверную структуру узлов.' };
    const draft: LocalDraft = {
      account: scope.account,
      campaign: scope.campaign,
      view: scope.view,
      schemaVersion: 1,
      roots: roots as PresentationNode[],
      name: value.name,
      baseContentRevision: value.baseContentRevision,
      baseMetadataRevision: value.baseMetadataRevision,
    };
    return { status: 'ok', draft };
  } catch { return { status: 'error', message: 'Не удалось прочитать локальный черновик.' }; }
}
function positiveRevision(value: JsonValue | undefined): value is Revision {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0;
  return isLosslessNumber(value) && /^[1-9]\d*$/.test(String(value));
}
function projectDraftNode(value: JsonValue): PresentationNode | null {
  if (!isRecord(value) || value.kind !== 'layout' || typeof value.nodeKey !== 'string' || value.nodeKey.length === 0 || typeof value.title !== 'string' || !('params' in value) || !Array.isArray(value.children)) return null;
  const children = value.children.map(projectDraftNode);
  if (children.some(child => child === null)) return null;
  return { kind: 'layout', nodeKey: value.nodeKey, title: value.title, params: value.params, children: children as PresentationNode[] };
}
function collectUniqueNodeKeys(node: PresentationNode, seen: Set<string>): boolean {
  if (seen.has(node.nodeKey)) return false;
  seen.add(node.nodeKey);
  return node.children.every(child => collectUniqueNodeKeys(child, seen));
}
export function readLocalDraft(storage: Pick<Storage, 'getItem'>, scope: LocalDraftScope): DraftRead | null {
  try { const raw = storage.getItem(localDraftKey(scope)); return raw === null ? null : parseDraft(raw, scope); }
  catch { return { status: 'error', message: 'Локальное хранилище недоступно.' }; }
}
export function writeLocalDraft(storage: Pick<Storage, 'setItem'>, draft: LocalDraft): void { storage.setItem(localDraftKey(draft), stringifyDraft(draft)); }
export function removeLocalDraft(storage: Pick<Storage, 'removeItem'>, scope: LocalDraftScope): void { storage.removeItem(localDraftKey(scope)); }
