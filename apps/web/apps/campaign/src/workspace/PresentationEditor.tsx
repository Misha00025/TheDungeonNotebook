import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isLosslessNumber } from 'lossless-json';
import type { ComputedSheet, FieldReference, JsonValue } from './types';
import { stringifyJson } from './json';
import { duplicateNode, findNode, insertNode, makeNode, moveNode, patchNodeParams, readParams, removeTreeNode, updateNode, type FieldPart, type PresentationNode, type PresentationType } from './presentationModel';
import PresentationRenderer, { type PresentationDropPlacement } from './PresentationRenderer';
import styles from './Presentation.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

export type PresentationEditorProps = { roots: PresentationNode[]; onChange: (roots: PresentationNode[]) => void; sheet?: ComputedSheet; choicesSheet?: ComputedSheet; sample?: boolean; disabled?: boolean };
type FieldOption = { reference: FieldReference; value: string; label: string; numeric: boolean };
const palette: { type: PresentationType; label: string }[] = [
  { type: 'group', label: 'Группа' },
  { type: 'composite', label: 'Составной показатель' },
  { type: 'resource', label: 'Ресурс' },
  { type: 'stat-list', label: 'Список характеристик' },
];
const referenceValue = (reference?: FieldReference) => reference ? `${reference.kind}:${encodeURIComponent(reference.fieldId)}` : '';
const parseReference = (value: string): FieldReference | null => {
  const split = value.indexOf(':');
  if (split < 0) return null;
  const kind = value.slice(0, split);
  try { return (kind === 'Base' || kind === 'Virtual') ? { kind, fieldId: decodeURIComponent(value.slice(split + 1)) } : null; } catch { return null; }
};
const asJsonReference = (reference: FieldReference) => ({ kind: reference.kind, fieldId: reference.fieldId });
const isJsonObject = (value: JsonValue): value is { [key: string]: JsonValue } => typeof value === 'object' && value !== null && !Array.isArray(value) && !isLosslessNumber(value);
const reorder = <T,>(items: T[], index: number, offset: number): T[] => {
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items]; const [item] = next.splice(index, 1); next.splice(nextIndex, 0, item); return next;
};
const locate = (roots: PresentationNode[], key: string, parentKey: string | null = null): { parentKey: string | null; index: number; siblings: PresentationNode[] } | undefined => {
  for (let index = 0; index < roots.length; index++) {
    if (roots[index].nodeKey === key) return { parentKey, index, siblings: roots };
    const nested = locate(roots[index].children, key, roots[index].nodeKey);
    if (nested) return nested;
  }
  return undefined;
};
const eventPayload = (event: React.DragEvent): { kind: 'palette'; type: PresentationType } | { kind: 'node'; nodeKey: string } | null => {
  try {
    const value = JSON.parse(event.dataTransfer.getData('application/x-tdn-presentation')) as { kind?: string; type?: string; nodeKey?: string };
    if (value.kind === 'palette' && palette.some(item => item.type === value.type)) return { kind: 'palette', type: value.type as PresentationType };
    if (value.kind === 'node' && typeof value.nodeKey === 'string') return { kind: 'node', nodeKey: value.nodeKey };
  } catch { return null; }
  return null;
};

const PresentationEditor: React.FC<PresentationEditorProps> = React.memo(({ roots, onChange, sheet, choicesSheet, sample = false, disabled = false }) => {
  const [preview, setPreview] = useState(false);
  const rootDropRef = useRef<HTMLDivElement>(null);
  const [settingsDraft, setSettingsDraft] = useState<PresentationNode | null>(null);
  const settingsDraftRef = useRef<PresentationNode | null>(null);
  const activeSettings = settingsDraft && findNode(roots, settingsDraft.nodeKey) ? settingsDraft : undefined;
  const settingsRead = activeSettings ? readParams(activeSettings.params) : undefined;
  useEffect(() => {
    const draft = settingsDraftRef.current;
    if (draft && (preview || !findNode(roots, draft.nodeKey))) {
      settingsDraftRef.current = null;
      setSettingsDraft(null);
    }
  }, [preview, roots]);
  const latest = useRef({ roots, onChange, disabled, preview });
  useLayoutEffect(() => { latest.current = { roots, onChange, disabled, preview }; });
  useEffect(() => {
    const clear = () => rootDropRef.current?.removeAttribute('data-active');
    if (disabled || preview) { clear(); return; }
    document.addEventListener('drop', clear, true);
    document.addEventListener('dragend', clear, true);
    return () => {
      document.removeEventListener('drop', clear, true);
      document.removeEventListener('dragend', clear, true);
      clear();
    };
  }, [disabled, preview]);
  const choices = useMemo<FieldOption[]>(() => [
    ...(choicesSheet?.baseFields ?? sheet?.baseFields ?? []).map(field => ({ reference: { kind: 'Base' as const, fieldId: field.id }, value: `Base:${encodeURIComponent(field.id)}`, label: `${field.title || field.key} — характеристика`, numeric: field.valueType === 'Integer' || field.valueType === 'Number' })),
    ...(choicesSheet?.virtualFields ?? sheet?.virtualFields ?? []).map(field => ({ reference: { kind: 'Virtual' as const, fieldId: field.id }, value: `Virtual:${encodeURIComponent(field.id)}`, label: `${field.title || field.key} — вычисляемая`, numeric: true })),
  ], [sheet, choicesSheet]);
  const refsFromParts = settingsRead?.status === 'supported' && settingsRead.type === 'composite' ? settingsRead.params.parts.flatMap(part => 'source' in part ? [part.source] : []) : [];
  const partBaseChoices = choices.filter(option => option.reference.kind === 'Base' && refsFromParts.some(reference => reference.kind === 'Base' && reference.fieldId === option.reference.fieldId));

  const updateSettingsDraft = (update: (node: PresentationNode) => PresentationNode) => {
    const current = settingsDraftRef.current;
    if (!current) return;
    const next = update(current);
    settingsDraftRef.current = next;
    setSettingsDraft(next);
  };
  const closeSettings = useCallback(() => {
    const draft = settingsDraftRef.current;
    settingsDraftRef.current = null;
    setSettingsDraft(null);
    const latestState = latest.current;
    if (!draft || latestState.disabled) return;
    const current = findNode(latestState.roots, draft.nodeKey);
    if (!current || (draft.title === current.title && stringifyJson(draft.params) === stringifyJson(current.params))) return;
    const next = updateNode(latestState.roots, draft.nodeKey, node => ({ ...node, title: draft.title, params: draft.params }));
    if (next !== latestState.roots) latestState.onChange(next);
  }, []);
  const patch = (changes: Record<string, JsonValue>) => {
    const current = settingsDraftRef.current;
    if (!current) return;
    const currentRead = readParams(current.params);
    const originalParams = isJsonObject(current.params) ? current.params : undefined;
    if (currentRead.status === 'supported' && currentRead.type === 'group' && originalParams?.type === undefined) {
      const params: Record<string, JsonValue> = { ...currentRead.params };
      if (!originalParams) params.legacyParams = current.params;
      Object.assign(params, changes);
      updateSettingsDraft(node => ({ ...node, params }));
      return;
    }
    updateSettingsDraft(node => patchNodeParams(node, changes));
  };
  const patchTitle = (title: string) => updateSettingsDraft(node => ({ ...node, title }));
  const add = useCallback((type: PresentationType, parentKey: string | null = null, index?: number) => {
    const current = latest.current;
    if (current.disabled || current.preview) return;
    const node = makeNode(type);
    const next = insertNode(current.roots, node, parentKey, index);
    if (next !== current.roots) current.onChange(next);
    settingsDraftRef.current = null; setSettingsDraft(null); setPreview(false);
  }, []);
  const moveDrop = useCallback((targetKey: string | null, placement: PresentationDropPlacement | 'root', event: React.DragEvent) => {
    const current = latest.current;
    if (current.disabled || current.preview) return;
    if (!Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) return;
    event.preventDefault();
    const source = eventPayload(event);
    if (!source) return;
    const targetPosition = targetKey ? locate(current.roots, targetKey) : undefined;
    const parentKey = placement === 'root' ? null : placement === 'inside' ? targetKey : targetPosition?.parentKey ?? null;
    const index = placement === 'root' ? current.roots.length : placement === 'inside' ? (findNode(current.roots, targetKey!)?.children.length ?? 0) : targetPosition ? targetPosition.index + (placement === 'after' ? 1 : 0) : current.roots.length;
    if (source.kind === 'palette') add(source.type, parentKey, index);
    else {
      const next = moveNode(current.roots, source.nodeKey, parentKey, index);
      if (next !== current.roots) { current.onChange(next); settingsDraftRef.current = null; setSettingsDraft(null); }
    }
  }, [add]);
  const handleRootDrop = useCallback((event: React.DragEvent) => {
    event.stopPropagation();
    if (event.defaultPrevented || latest.current.disabled || latest.current.preview) return;
    moveDrop(null, 'root', event);
  }, [moveDrop]);
  const configureAs = (type: PresentationType) => {
    const current = settingsDraftRef.current;
    if (!current || disabled || !window.confirm(`Настроить компонент как «${palette.find(item => item.type === type)?.label}»? Неизвестные параметры и исходные данные сохранятся.`)) return;
    const defaultsValue = makeNode(type).params;
    const defaults = isJsonObject(defaultsValue) ? defaultsValue : {};
    const source = isJsonObject(current.params) ? current.params : { legacyParams: current.params };
    const reserved = new Set(['version', 'type', 'direction', 'columns', 'gap', 'appearance', 'parts', 'primary', 'current', 'maximum', 'showBar', 'entries', 'legacyFormatError']);
    const unknown = Object.fromEntries(Object.entries(source).filter(([key]) => !reserved.has(key)));
    updateSettingsDraft(node => ({ ...node, params: { ...unknown, ...defaults } }));
  };
  const onDropNode = useCallback((targetKey: string, placement: PresentationDropPlacement, event: React.DragEvent) => moveDrop(targetKey, placement, event), [moveDrop]);
  const handleAction = useCallback((nodeKey: string, action: 'duplicate' | 'delete' | 'more') => {
    const current = latest.current;
    if (current.preview) return;
    const node = findNode(current.roots, nodeKey);
    if (!node) return;
    if (action === 'more') {
      settingsDraftRef.current = node;
      setSettingsDraft(node);
      return;
    }
    if (current.disabled) return;
    let next = current.roots;
    if (action === 'duplicate') next = duplicateNode(current.roots, nodeKey);
    if (action === 'delete') {
      if (node.children.length && !window.confirm('Удалить группу вместе со всеми вложенными компонентами?')) return;
      next = removeTreeNode(current.roots, nodeKey);
    }
    if (next !== current.roots) current.onChange(next);
  }, []);
  const renderNodeActions = useCallback((node: PresentationNode) => {
    return <>
       <IconButton icon="copy" title="Дублировать" ariaLabel="Дублировать" size="small" variant="secondary" disabled={disabled} onClick={() => handleAction(node.nodeKey, 'duplicate')} />
       <IconButton icon="delete" title="Удалить" ariaLabel="Удалить" size="small" variant="danger" disabled={disabled} onClick={() => handleAction(node.nodeKey, 'delete')} />
       <IconButton icon="more" title="Настройки компонента" ariaLabel="Настройки компонента" size="small" variant="secondary" onClick={() => handleAction(node.nodeKey, 'more')} />
    </>;
  }, [disabled, handleAction]);
  const newPart = (kind: 'text' | 'source'): FieldPart => kind === 'text' ? { text: '' } : { source: asJsonReference(choices[0]?.reference ?? { kind: 'Base', fieldId: '' }) };
  const updateParts = (parts: FieldPart[]) => {
    const currentRead = settingsDraftRef.current ? readParams(settingsDraftRef.current.params) : undefined;
    const primary = currentRead?.status === 'supported' && currentRead.type === 'composite' ? currentRead.params.primary : null;
    const stillPresent = primary && parts.some(part => 'source' in part && part.source.kind === 'Base' && part.source.fieldId === primary.fieldId);
    const jsonParts: JsonValue[] = parts.map((part): JsonValue => {
      if ('text' in part) return { text: part.text };
      const projection: Record<string, JsonValue> = { source: { kind: part.source.kind, fieldId: part.source.fieldId } };
      if (part.signed) projection.signed = true;
      return projection;
    });
    patch({ parts: jsonParts, ...(stillPresent ? {} : { primary: null }) });
  };
  const updateEntries = (entries: { source: ReturnType<typeof asJsonReference>; label: string }[]) => patch({ entries: entries.map(entry => ({ source: { kind: entry.source.kind, fieldId: entry.source.fieldId }, label: entry.label })) });

  return <section className={styles.editor}>
    <header className={styles.editorHeader}><h2>Конструктор отображения</h2><button type="button" disabled={disabled} onClick={() => { setPreview(value => !value); settingsDraftRef.current = null; setSettingsDraft(null); }}>{preview ? 'Редактировать' : 'Предпросмотр'}</button></header>
    {!preview && <div className={styles.palette} role="group" aria-label="Компоненты">
      <h3>Компоненты</h3>
          {palette.map(item => <button key={item.type} type="button" draggable={!disabled} disabled={disabled} onClick={() => add(item.type)} onDragStart={event => event.dataTransfer.setData('application/x-tdn-presentation', JSON.stringify({ kind: 'palette', type: item.type }))}>{item.label}</button>)}
    </div>}
    <div className={`${styles.editorLayout} ${preview ? styles.previewLayout : ''}`}>
      <main className={styles.canvasColumn}>
        <div className={`${styles.canvas} ${roots.length === 0 ? styles.emptyCanvas : ''}`} onDragOver={!preview && !disabled ? event => { if (!event.defaultPrevented && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.preventDefault(); } : undefined} onDrop={!preview && !disabled ? handleRootDrop : undefined}>
          {roots.length === 0 && preview ? <p className={styles.emptyPreview}>Холст пуст</p> : roots.length === 0 ? <div className={styles.emptyState}><p>Холст пока пуст</p><button type="button" disabled={disabled} onClick={() => add('group')}>Добавьте первый компонент</button></div> : <PresentationRenderer roots={roots} sheet={sheet} sample={sample} onDropNode={!preview && !disabled ? onDropNode : undefined} renderNodeActions={!preview ? renderNodeActions : undefined} />}
          {roots.length > 0 && !preview && <div ref={rootDropRef} className={styles.rootDrop} aria-label="Добавить в конец холста" onDragEnter={event => { if (!disabled && !latest.current.preview && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.currentTarget.setAttribute('data-active', 'true'); }} onDragOver={event => { if (!disabled && !event.defaultPrevented && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.preventDefault(); }} onDragLeave={event => event.currentTarget.removeAttribute('data-active')} onDrop={event => { event.currentTarget.removeAttribute('data-active'); handleRootDrop(event); }} />}
        </div>
      </main>
      <ModalPortal isOpen={!preview && Boolean(activeSettings)} title="Настройки компонента" size="wide" onClose={closeSettings}>
        {activeSettings && settingsRead && <div className={styles.properties}>
          <label>Название<input value={activeSettings.title} disabled={disabled} onChange={event => patchTitle(event.target.value)} /></label>
          {settingsRead.status !== 'supported' ? <div className={styles.unsupported} role="status"><p>{settingsRead.message}</p><span>Настроить как:</span>{palette.map(item => <button key={item.type} type="button" disabled={disabled} onClick={() => configureAs(item.type)}>{item.label}</button>)}</div> : settingsRead.type === 'group' ? <>
            <label>Направление<select disabled={disabled} value={settingsRead.params.direction} onChange={event => patch({ direction: event.target.value })}><option value="row">По строке</option><option value="column">По колонкам</option></select></label>
            <label>Колонки<select disabled={disabled} value={settingsRead.params.columns} onChange={event => patch({ columns: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Интервал<select disabled={disabled} value={settingsRead.params.gap} onChange={event => patch({ gap: event.target.value })}><option value="small">Маленький</option><option value="medium">Средний</option><option value="large">Большой</option></select></label>
            <label>Оформление<select disabled={disabled} value={settingsRead.params.appearance} onChange={event => patch({ appearance: event.target.value })}><option value="plain">Простое</option><option value="panel">Панель</option></select></label>
          </> : settingsRead.type === 'composite' ? <>
            <h4>Состав</h4>{settingsRead.params.parts.map((part, index) => <div className={styles.partEditor} key={index}>
              {'text' in part ? <><span>Текст</span><input aria-label={`Текст, часть ${index + 1}`} disabled={disabled} value={part.text} onChange={event => { const parts = [...settingsRead.params.parts]; parts[index] = { text: event.target.value }; updateParts(parts); }} /></> : <><span>Характеристика</span><select aria-label={`Характеристика, часть ${index + 1}`} disabled={disabled} value={referenceValue(part.source)} onChange={event => { const reference = parseReference(event.target.value); if (!reference) return; const parts = [...settingsRead.params.parts]; parts[index] = { source: asJsonReference(reference), ...(part.signed ? { signed: true } : {}) }; updateParts(parts); }}><option value="">Выберите характеристику</option>{choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label><input type="checkbox" disabled={disabled} checked={Boolean(part.signed)} onChange={event => { const parts = [...settingsRead.params.parts]; parts[index] = { source: part.source, ...(event.target.checked ? { signed: true } : {}) }; updateParts(parts); }} />Со знаком</label></>}
              <div className={styles.partActions}><button type="button" disabled={disabled || index === 0} onClick={() => updateParts(reorder(settingsRead.params.parts, index, -1))}>Выше</button><button type="button" disabled={disabled || index === settingsRead.params.parts.length - 1} onClick={() => updateParts(reorder(settingsRead.params.parts, index, 1))}>Ниже</button><button type="button" disabled={disabled} onClick={() => updateParts(settingsRead.params.parts.filter((_, partIndex) => partIndex !== index))}>Удалить</button></div>
            </div>)}
            <div className={styles.inlineActions}><button type="button" disabled={disabled} onClick={() => updateParts([...settingsRead.params.parts, newPart('text')])}>Добавить текст</button><button type="button" disabled={disabled || choices.length === 0} onClick={() => updateParts([...settingsRead.params.parts, newPart('source')])}>Добавить характеристику</button></div>
            <label>Основное значение<select disabled={disabled} value={referenceValue(settingsRead.params.primary ?? undefined)} onChange={event => { const reference = parseReference(event.target.value); patch({ primary: reference?.kind === 'Base' && partBaseChoices.some(option => option.reference.fieldId === reference.fieldId) ? asJsonReference(reference) : null }); }}><option value="">Только чтение</option>{partBaseChoices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </> : settingsRead.type === 'resource' ? <>
            <label>Текущее значение<select disabled={disabled} value={referenceValue(settingsRead.params.current ?? undefined)} onChange={event => { const reference = parseReference(event.target.value); patch({ current: reference ? asJsonReference(reference) : null }); }}><option value="">Выберите характеристику</option>{settingsRead.params.current && !choices.some(option => option.numeric && option.value === referenceValue(settingsRead.params.current!)) && <option value={referenceValue(settingsRead.params.current)}>Сохранённый источник недоступен или имеет другой тип</option>}{choices.filter(option => option.numeric).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Максимум<select disabled={disabled} value={referenceValue(settingsRead.params.maximum ?? undefined)} onChange={event => patch({ maximum: event.target.value ? asJsonReference(parseReference(event.target.value)!) : null })}><option value="">Не задан</option>{settingsRead.params.maximum && !choices.some(option => option.numeric && option.value === referenceValue(settingsRead.params.maximum!)) && <option value={referenceValue(settingsRead.params.maximum)}>Сохранённый максимум недоступен</option>}{choices.filter(option => option.numeric).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><input type="checkbox" disabled={disabled} checked={settingsRead.params.showBar} onChange={event => patch({ showBar: event.target.checked })} />Показывать шкалу</label>
          </> : <>
            <h4>Характеристики</h4>{settingsRead.params.entries.map((entry, index) => <div className={styles.entryEditor} key={`${entry.source.kind}:${entry.source.fieldId}:${index}`}>
              <label>Источник<select disabled={disabled} value={referenceValue(entry.source)} onChange={event => { const reference = parseReference(event.target.value); if (!reference) return; const entries = [...settingsRead.params.entries]; entries[index] = { ...entry, source: asJsonReference(reference) }; updateEntries(entries); }}><option value="">Выберите характеристику</option>{choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>Подпись<input disabled={disabled} value={entry.label} onChange={event => { const entries = [...settingsRead.params.entries]; entries[index] = { ...entry, label: event.target.value }; updateEntries(entries); }} /></label>
              <div className={styles.partActions}><button type="button" disabled={disabled || index === 0} onClick={() => updateEntries(reorder(settingsRead.params.entries, index, -1))}>Выше</button><button type="button" disabled={disabled || index === settingsRead.params.entries.length - 1} onClick={() => updateEntries(reorder(settingsRead.params.entries, index, 1))}>Ниже</button><button type="button" disabled={disabled} onClick={() => updateEntries(settingsRead.params.entries.filter((_, entryIndex) => entryIndex !== index))}>Удалить</button></div>
            </div>)}
            <button type="button" disabled={disabled || choices.length === 0} onClick={() => updateEntries([...settingsRead.params.entries, { source: asJsonReference(choices[0].reference), label: '' }])}>Добавить характеристику</button>
            <label>Колонки<select disabled={disabled} value={settingsRead.params.columns} onChange={event => patch({ columns: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</select></label>
          </>}
        </div>}
      </ModalPortal>
    </div>
  </section>;
});

export default PresentationEditor;
