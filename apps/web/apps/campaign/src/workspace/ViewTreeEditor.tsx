import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { isLosslessNumber } from 'lossless-json';
import type { JsonValue, ViewNode, WidgetNode, WidgetSource } from './types';
import { parseJson, stringifyJson } from './json';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';
import { useDirtyDraft } from './Workspace';

type Props = { roots: ViewNode[]; onChange: (roots: ViewNode[]) => void; disabled?: boolean; onValidityChange?: (valid: boolean) => void; resetKey?: number };
type Row = { id: string; node: ViewNode; children: Row[]; paramsText: string; paramsError?: string };
const makeRows = (nodes: ViewNode[]): Row[] => nodes.map(node => ({ id: crypto.randomUUID(), node, children: makeRows(node.children), paramsText: stringifyJson(node.params, 2) }));
const walk = (rows: Row[], visit: (row: Row) => void) => rows.forEach(row => { visit(row); walk(row.children, visit); });
const flatten = (rows: Row[]): ViewNode[] => rows.map(row => {
  const base = { ...row.node, params: row.paramsError ? row.node.params : parseJson(row.paramsText), children: flatten(row.children) };
  return base;
});
const semantic = (rows: Row[]): unknown => rows.map(({ node, children, paramsText }) => [node.nodeKey, node.title, node.kind, paramsText, node.kind === 'widget' ? node.sources : null, node.kind === 'widget' ? node.format : null, semantic(children)]);
const makeNode = (kind: 'layout' | 'widget'): Row => {
  const base = { nodeKey: '', title: '', params: { direction: 'column' } as JsonValue, children: [] as ViewNode[] };
  const node: ViewNode = kind === 'layout' ? { ...base, kind } : { ...base, kind, sources: [], format: '' };
  return { id: crypto.randomUUID(), node, children: [], paramsText: '{\n  "direction": "column"\n}' };
};

export const ViewTreeEditor: React.FC<Props> = ({ roots, onChange, disabled = false, onValidityChange, resetKey = 0 }) => {
  const owner = useId();
  const [rows, setRows] = useState(() => makeRows(roots));
  const initial = useRef({ resetKey, roots });
  const baseline = useRef(makeRows(roots));
  const callback = useRef(onValidityChange);
  const [validityRevision, setValidityRevision] = useState(0);
  useEffect(() => { callback.current = onValidityChange; }, [onValidityChange]);
  useEffect(() => {
    if (initial.current.resetKey === resetKey) return;
    initial.current = { resetKey, roots };
    const next = makeRows(roots);
    baseline.current = makeRows(roots);
    setRows(next);
  }, [resetKey, roots]);
  const duplicate = useMemo(() => { const seen = new Set<string>(); let found = false; walk(rows, row => { const key = row.node.nodeKey.trim(); if (key && seen.has(key)) found = true; seen.add(key); }); return found; }, [rows]);
  const valid = !duplicate && (() => { let okay = true; walk(rows, row => { if (row.paramsError) okay = false; }); return okay; })();
  useEffect(() => { callback.current?.(valid); }, [valid, validityRevision]);
  useDirtyDraft(`view-tree-${owner}`, stringifyJson(semantic(rows)) !== stringifyJson(semantic(baseline.current)));
  const publish = (next: Row[]) => { setRows(next); setValidityRevision(value => value + 1); onChange(flatten(next)); };
  const mutate = (path: number[], action: (list: Row[], index: number) => Row[]) => {
    const change = (list: Row[], depth: number): Row[] => depth === path.length - 1 ? action(list, path[depth]) : list.map((row, index) => index === path[depth] ? { ...row, children: change(row.children, depth + 1) } : row);
    publish(change(rows, 0));
  };
  const setAt = (path: number[], update: (row: Row) => Row) => {
    const change = (list: Row[], depth: number): Row[] => list.map((row, index) => index !== path[depth] ? row : depth === path.length - 1 ? update(row) : { ...row, children: change(row.children, depth + 1) });
    return change(rows, 0);
  };
  const renderRows = (list: Row[], path: number[] = []): React.ReactNode => list.map((row, index) => {
    const at = [...path, index]; const node = row.node;
    const update = (patch: Partial<ViewNode>) => publish(setAt(at, item => ({ ...item, node: { ...item.node, ...patch } as ViewNode })));
    const replaceNode = (next: ViewNode) => publish(setAt(at, item => ({ ...item, node: next })));
    const paramChange = (text: string) => {
      let paramsError: string | undefined; let params = node.params;
      try { params = parseJson(text); } catch (error) { paramsError = error instanceof Error ? error.message : String(error); }
      publish(setAt(at, item => ({ ...item, paramsText: text, paramsError, node: paramsError ? item.node : { ...item.node, params } as ViewNode })));
    };
    const addSource = () => update({ sources: [...(node.kind === 'widget' ? node.sources : []), { kind: 'Base', fieldId: '' }] } as Partial<WidgetNode>);
    return <section className={commonStyles.card} key={row.id} aria-label={`Узел ${node.title || node.nodeKey || index + 1}`}>
      <fieldset disabled={disabled} className={styles.nodeFields} aria-label={`Поля узла ${node.title || node.nodeKey || index + 1}`}>
        <label className={commonStyles.formGroup}>Тип<select className={inputStyles.input} value={node.kind} onChange={event => {
          const kind = event.target.value as 'layout' | 'widget'; if (kind === node.kind) return;
          if (node.kind === 'widget' && !window.confirm('Преобразовать в Layout и удалить источники и формат?')) return;
          const converted: ViewNode = kind === 'layout' ? { kind, nodeKey: node.nodeKey, title: node.title, params: node.params, children: node.children } : { kind, nodeKey: node.nodeKey, title: node.title, params: node.params, children: node.children, sources: [], format: '' };
          replaceNode(converted);
        }}><option value="layout">Layout</option><option value="widget">Widget</option></select></label>
        <label className={commonStyles.formGroup}>nodeKey<input className={inputStyles.input} value={node.nodeKey} onChange={event => update({ nodeKey: event.target.value })} /></label>
        <label className={commonStyles.formGroup}>Заголовок<input className={inputStyles.input} value={node.title} onChange={event => update({ title: event.target.value })} /></label>
        <label className={commonStyles.formGroup}>Параметры (JSON)<textarea className={inputStyles.input} value={row.paramsText} onChange={event => paramChange(event.target.value)} /></label>
        {row.paramsError && <p role="alert">Некорректный JSON: {row.paramsError}</p>}
        {node.params !== null && typeof node.params === 'object' && !Array.isArray(node.params) && !isLosslessNumber(node.params) && !row.paramsError && <label className={commonStyles.formGroup}>Направление<select className={inputStyles.input} value={(node.params as Record<string, JsonValue>).direction === 'row' ? 'row' : 'column'} onChange={event => { try { const current = parseJson(row.paramsText); if (!current || typeof current !== 'object' || Array.isArray(current) || isLosslessNumber(current)) return; paramChange(stringifyJson({ ...current, direction: event.target.value }, 2)); } catch { return; } }}><option value="column">Колонка</option><option value="row">Строка</option></select></label>}
        {node.kind === 'widget' && <>
          <label className={commonStyles.formGroup}>Формат<textarea className={inputStyles.input} value={node.format} onChange={event => update({ format: event.target.value } as Partial<WidgetNode>)} /></label>
          <p>Формат сохраняется как непрозрачный текст; синтаксис проверяется только в предпросмотре.</p>
          {node.sources.map((source, sourceIndex) => <div className={styles.grid} role="group" aria-label={`Источник ${sourceIndex + 1}`} key={`${row.id}-source-${sourceIndex}`}>
            <label>Вид<select className={inputStyles.input} value={source.kind} onChange={event => { const sources = node.sources.map((item, i) => i === sourceIndex ? { ...item, kind: event.target.value as WidgetSource['kind'] } : item); update({ sources } as Partial<WidgetNode>); }}><option value="Base">Base</option><option value="Virtual">Virtual</option></select></label>
            <label>Field ID<input className={inputStyles.input} value={source.fieldId} onChange={event => { const sources = node.sources.map((item, i) => i === sourceIndex ? { ...item, fieldId: event.target.value } : item); update({ sources } as Partial<WidgetNode>); }} /></label>
            <button type="button" className={buttonStyles.button} onClick={() => update({ sources: node.sources.filter((_, i) => i !== sourceIndex) } as Partial<WidgetNode>)}>Удалить источник</button>
            <button type="button" aria-label={`Источник ${sourceIndex + 1}: вверх`} disabled={sourceIndex === 0} className={buttonStyles.button} onClick={() => { const sources = node.sources.slice(); [sources[sourceIndex - 1], sources[sourceIndex]] = [sources[sourceIndex], sources[sourceIndex - 1]]; update({ sources } as Partial<WidgetNode>); }}>↑</button>
            <button type="button" aria-label={`Источник ${sourceIndex + 1}: вниз`} disabled={sourceIndex === node.sources.length - 1} className={buttonStyles.button} onClick={() => { const sources = node.sources.slice(); [sources[sourceIndex + 1], sources[sourceIndex]] = [sources[sourceIndex], sources[sourceIndex + 1]]; update({ sources } as Partial<WidgetNode>); }}>↓</button>
          </div>)}<button type="button" className={buttonStyles.button} onClick={addSource}>Добавить источник</button>
        </>}
      </fieldset>
      <div className={styles.actions}><button type="button" aria-label={`Узел ${node.title || node.nodeKey || index + 1}: вверх`} disabled={disabled || index === 0} className={buttonStyles.button} onClick={() => mutate(at, (items, i) => { const next = items.slice(); [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; })}>↑</button><button type="button" aria-label={`Узел ${node.title || node.nodeKey || index + 1}: вниз`} disabled={disabled || index === list.length - 1} className={buttonStyles.button} onClick={() => mutate(at, (items, i) => { const next = items.slice(); [next[i + 1], next[i]] = [next[i], next[i + 1]]; return next; })}>↓</button><button type="button" disabled={disabled} className={buttonStyles.button} onClick={() => { if (window.confirm('Удалить узел и всё его содержимое?')) mutate(at, (items, i) => items.filter((_, n) => n !== i)); }}>Удалить</button></div>
      <h4>Дочерние узлы</h4>{renderRows(row.children, at)}
      <button type="button" disabled={disabled} className={buttonStyles.button} onClick={() => mutate(at, (items, i) => items.map((item, n) => n === i ? { ...item, children: [...item.children, makeNode('layout')] } : item))}>Добавить Layout</button>
      <button type="button" disabled={disabled} className={buttonStyles.button} onClick={() => mutate(at, (items, i) => items.map((item, n) => n === i ? { ...item, children: [...item.children, makeNode('widget')] } : item))}>Добавить Widget</button>
    </section>;
  });
  return <div><h3>Дерево представления</h3>{duplicate && <p role="alert">nodeKey должен быть уникален во всём дереве.</p>}<div aria-live="polite" data-valid={valid} />{renderRows(rows)}<button type="button" disabled={disabled} className={buttonStyles.button} onClick={() => publish([...rows, makeNode('layout')])}>Добавить корневой Layout</button><button type="button" disabled={disabled} className={buttonStyles.button} onClick={() => publish([...rows, makeNode('widget')])}>Добавить корневой Widget</button></div>;
};
export default ViewTreeEditor;
