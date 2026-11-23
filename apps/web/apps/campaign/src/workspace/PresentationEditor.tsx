import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isLosslessNumber } from 'lossless-json';
import type { ComputedSheet, FieldReference, JsonValue } from './types';
import { stringifyJson } from './json';
import { duplicateNode, findNode, insertNode, makeNode, moveNode, patchNodeParams, readParams, removeTreeNode, updateNode, type FieldPart, type JsonFieldReference, type PresentationNode, type PresentationType } from './presentationModel';
import PresentationRenderer, { type PresentationDropPlacement } from './PresentationRenderer';
import styles from './Presentation.module.css';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import Checkbox from '@tdn/shared/ui/Form/Checkbox';
import { Field, Select, StatePanel } from '@tdn/shared';
import { compileStatListCondition, compileStatListFormat } from './statListFormat';
import PresentationSurfaceFrame from './PresentationSurfaceFrame';
import type { PresentationSurface } from './presentationModel';
import { PresentationCatalogSettings } from './PresentationCatalog';

export type PresentationEditorProps = { roots: PresentationNode[]; onChange: (roots: PresentationNode[]) => void; sheet?: ComputedSheet; choicesSheet?: ComputedSheet; sample?: boolean; disabled?: boolean; surface?: PresentationSurface; previewName?: string; previewDescription?: string; campaignId?: number };
type FieldOption = { reference: FieldReference; value: string; label: string; numeric: boolean };
const palette: { type: PresentationType; label: string }[] = [
  { type: 'group', label: 'Группа' },
  { type: 'composite', label: 'Составной показатель' },
  { type: 'resource', label: 'Ресурс' },
  { type: 'catalog', label: 'Каталог' },
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

const PresentationEditor: React.FC<PresentationEditorProps> = React.memo(({ roots, onChange, sheet, choicesSheet, sample = false, disabled = false, surface = 'page', previewName = 'Имя персонажа', previewDescription = 'Описание персонажа', campaignId }) => {
  const [preview, setPreview] = useState(false);
  const [widthMode, setWidthMode] = useState<'desktop' | 'mobile'>('desktop');
  const widthFieldId = useId();
  const rootDropRef = useRef<HTMLDivElement>(null);
  const [settingsDraft, setSettingsDraft] = useState<PresentationNode | null>(null);
  const [statSearch, setStatSearch] = useState('');
  const [catalogSettingsInvalid, setCatalogSettingsInvalid] = useState(false);
  const settingsDraftRef = useRef<PresentationNode | null>(null);
  const activeSettings = settingsDraft && findNode(roots, settingsDraft.nodeKey) ? settingsDraft : undefined;
  const settingsRead = activeSettings ? readParams(activeSettings.params) : undefined;
  const statFormat = useMemo(() => {
    const current = activeSettings ? readParams(activeSettings.params) : undefined;
    return current?.status === 'supported' && current.type === 'stat-list'
      ? compileStatListFormat(current.params.format, current.params.expressions)
      : undefined;
  }, [activeSettings?.params]);
  const statCondition = useMemo(() => {
    const current = activeSettings ? readParams(activeSettings.params) : undefined;
    return current?.status === 'supported' && current.type === 'stat-list' ? compileStatListCondition(current.params.condition) : undefined;
  }, [activeSettings?.params]);
  useEffect(() => { setStatSearch(''); }, [activeSettings?.nodeKey]);
  useEffect(() => {
    const draft = settingsDraftRef.current;
    if (draft && (preview || !findNode(roots, draft.nodeKey))) {
      settingsDraftRef.current = null;
      setSettingsDraft(null);
    }
  }, [preview, roots]);
  const latest = useRef({ roots, onChange, disabled, preview, surface, catalogSettingsInvalid });
  useLayoutEffect(() => { latest.current = { roots, onChange, disabled, preview, surface, catalogSettingsInvalid }; });
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
  const choices = useMemo<FieldOption[]>(() => {
    const fields: FieldOption[] = [];
    const seen = new Set<string>();
    for (const source of [choicesSheet, sheet]) {
      for (const field of source?.baseFields ?? []) {
        const key = `Base:${field.id}`;
        if (!seen.has(key)) { seen.add(key); fields.push({ reference: { kind: 'Base', fieldId: field.id }, value: `Base:${encodeURIComponent(field.id)}`, label: `${field.title || field.key} — характеристика`, numeric: field.valueType === 'Integer' || field.valueType === 'Number' }); }
      }
      for (const field of source?.virtualFields ?? []) {
        const key = `Virtual:${field.id}`;
        if (!seen.has(key)) { seen.add(key); fields.push({ reference: { kind: 'Virtual', fieldId: field.id }, value: `Virtual:${encodeURIComponent(field.id)}`, label: `${field.title || field.key} — вычисляемая`, numeric: true }); }
      }
    }
    return fields;
  }, [sheet, choicesSheet]);
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
    const draftRead = draft ? readParams(draft.params) : undefined;
    if (draftRead?.status === 'supported' && draftRead.type === 'catalog' && latest.current.catalogSettingsInvalid) return;
    settingsDraftRef.current = null;
    setSettingsDraft(null);
    setCatalogSettingsInvalid(false);
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
    if ((type === 'composite' || type === 'resource') && current.surface !== 'page') node.params = { ...(node.params as Record<string, JsonValue>), size: 'compact' };
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
      const reserved = new Set(['version', 'type', 'direction', 'columns', 'gap', 'appearance', 'parts', 'primary', 'current', 'maximum', 'showBar', 'size', 'entries', 'format', 'expressions', 'condition', 'kind', 'legacyFormatError']);
      const unknown = Object.fromEntries(Object.entries(source).filter(([key]) => !reserved.has(key)));
     const size = source.size === 'compact' || source.size === 'medium' || source.size === 'large' ? source.size : undefined;
     updateSettingsDraft(node => ({ ...node, params: { ...unknown, ...defaults, ...((type === 'resource' || type === 'composite') && size ? { size } : {}) } }));
  };
  const onDropNode = useCallback((targetKey: string, placement: PresentationDropPlacement, event: React.DragEvent) => moveDrop(targetKey, placement, event), [moveDrop]);
  const handleAction = useCallback((nodeKey: string, action: 'duplicate' | 'delete' | 'more') => {
    const current = latest.current;
    if (current.preview) return;
    const node = findNode(current.roots, nodeKey);
    if (!node) return;
    if (action === 'more') {
      setCatalogSettingsInvalid(false);
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
  const updateEntries = (entries: { source: JsonFieldReference; label: string; [key: string]: JsonValue }[]) => patch({ entries });

  return <section className={styles.editor}>
     <header className={styles.editorHeader}><h2>Конструктор отображения</h2><div className={styles.inlineActions}>{!preview && <Field className={styles.widthField} label="Ширина" htmlFor={widthFieldId}><Select id={widthFieldId} value={widthMode} onChange={event => setWidthMode(event.target.value as 'desktop' | 'mobile')}><option value="desktop">ПК</option><option value="mobile">Мобильный</option></Select></Field>}<button type="button" disabled={disabled || catalogSettingsInvalid} onClick={() => { setPreview(value => !value); settingsDraftRef.current = null; setSettingsDraft(null); }}>{preview ? 'Редактировать' : 'Предпросмотр'}</button></div></header>
    {!preview && <div className={styles.palette} role="group" aria-label="Компоненты">
      <h3>Компоненты</h3>
          {palette.map(item => <button key={item.type} type="button" draggable={!disabled} disabled={disabled} onClick={() => add(item.type)} onDragStart={event => event.dataTransfer.setData('application/x-tdn-presentation', JSON.stringify({ kind: 'palette', type: item.type }))}>{item.label}</button>)}
    </div>}
     <div className={`${styles.editorLayout} ${preview ? styles.previewLayout : ''}`}>
      <main className={styles.canvasColumn}>
        <div className={`${styles.canvas} ${roots.length === 0 ? styles.emptyCanvas : ''} ${surface !== 'page' ? styles.surfaceCanvas : ''}`} onDragOver={surface === 'page' && !preview && !disabled ? event => { if (!event.defaultPrevented && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.preventDefault(); } : undefined} onDrop={surface === 'page' && !preview && !disabled ? handleRootDrop : undefined}>
          {surface === 'page' ? <>
            {roots.length === 0 && preview ? <p className={styles.emptyPreview}>Холст пуст</p> : roots.length === 0 ? <div className={styles.emptyState}><p>Холст пока пуст</p><button type="button" disabled={disabled} onClick={() => add('group')}>Добавьте первый компонент</button></div> : <PresentationRenderer roots={roots} sheet={sheet} sample={sample} surface={surface} onDropNode={!preview && !disabled ? onDropNode : undefined} renderNodeActions={!preview ? renderNodeActions : undefined} />}
          </> : <div className={styles.surfacePreview}>
            <PresentationSurfaceFrame surface={surface} widthMode={widthMode} title={previewName} description={previewDescription} actions={surface === 'card' ? <button type="button" disabled>Открыть лист</button> : undefined}>
              <div className={styles.surfaceEditArea} data-empty={roots.length === 0 ? 'true' : undefined} onDragOver={!preview && !disabled ? event => { if (!event.defaultPrevented && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.preventDefault(); } : undefined} onDrop={!preview && !disabled ? handleRootDrop : undefined}>
                {roots.length === 0 ? <div className={styles.surfaceEmptyEditor}>{!preview && <button type="button" disabled={disabled} onClick={() => add('group')}>Добавить первый компонент</button>}</div> : <PresentationRenderer roots={roots} sheet={sheet} sample={sample} surface={surface} onDropNode={!preview && !disabled ? onDropNode : undefined} renderNodeActions={!preview ? renderNodeActions : undefined} />}
                {roots.length > 0 && !preview && <div ref={rootDropRef} className={styles.rootDrop} aria-label="Добавить в конец области" onDragEnter={event => { if (!disabled && !latest.current.preview && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.currentTarget.setAttribute('data-active', 'true'); }} onDragOver={event => { if (!disabled && !event.defaultPrevented && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.preventDefault(); }} onDragLeave={event => event.currentTarget.removeAttribute('data-active')} onDrop={event => { event.currentTarget.removeAttribute('data-active'); handleRootDrop(event); }} />}
              </div>
            </PresentationSurfaceFrame>
          </div>}
          {surface === 'page' && roots.length > 0 && !preview && <div ref={rootDropRef} className={styles.rootDrop} aria-label="Добавить в конец холста" onDragEnter={event => { if (!disabled && !latest.current.preview && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.currentTarget.setAttribute('data-active', 'true'); }} onDragOver={event => { if (!disabled && !event.defaultPrevented && Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) event.preventDefault(); }} onDragLeave={event => event.currentTarget.removeAttribute('data-active')} onDrop={event => { event.currentTarget.removeAttribute('data-active'); handleRootDrop(event); }} />}
        </div>
      </main>
     <ModalPortal isOpen={!preview && Boolean(activeSettings)} title="Настройки компонента" size="wide" onClose={closeSettings} dismissDisabled={settingsRead?.status === 'supported' && settingsRead.type === 'catalog' && catalogSettingsInvalid}>
        {activeSettings && settingsRead && <div className={styles.properties}>
          <label>Название<input value={activeSettings.title} disabled={disabled} onChange={event => patchTitle(event.target.value)} /></label>
           {settingsRead.status !== 'supported' ? <div className={styles.unsupported} role="status"><p>{settingsRead.message}</p><span>Настроить как:</span>{palette.map(item => <button key={item.type} type="button" disabled={disabled} onClick={() => configureAs(item.type)}>{item.label}</button>)}</div> : settingsRead.type === 'group' ? <>
              <label>Направление<Select disabled={disabled} value={settingsRead.params.direction} onChange={event => patch({ direction: event.target.value })}><option value="row">По строкам</option><option value="column">По колонкам</option></Select></label>
             <label>Колонки<Select disabled={disabled} value={settingsRead.params.columns} onChange={event => patch({ columns: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</Select></label>
             <label>Интервал<Select disabled={disabled} value={settingsRead.params.gap} onChange={event => patch({ gap: event.target.value })}><option value="small">Маленький</option><option value="medium">Средний</option><option value="large">Большой</option></Select></label>
             <label>Оформление<Select disabled={disabled} value={settingsRead.params.appearance} onChange={event => patch({ appearance: event.target.value })}><option value="plain">Простое</option><option value="panel">Панель</option></Select></label>
           </> : settingsRead.type === 'composite' ? <>
              <label>Размер<Select disabled={disabled} value={settingsRead.params.size} onChange={event => patch({ size: event.target.value })}><option value="compact">Компактный</option><option value="medium">Средний</option><option value="large">Большой</option></Select></label>
            <h4>Состав</h4>{settingsRead.params.parts.map((part, index) => <div className={styles.partEditor} key={index}>
                {'text' in part ? <><span>Текст</span><input aria-label={`Текст, часть ${index + 1}`} disabled={disabled} value={part.text} onChange={event => { const parts = [...settingsRead.params.parts]; parts[index] = { text: event.target.value }; updateParts(parts); }} /></> : <><span>Характеристика</span><Select aria-label={`Характеристика, часть ${index + 1}`} disabled={disabled} value={referenceValue(part.source)} onChange={event => { const reference = parseReference(event.target.value); if (!reference) return; const parts = [...settingsRead.params.parts]; parts[index] = { source: asJsonReference(reference), ...(part.signed ? { signed: true } : {}) }; updateParts(parts); }}><option value="">Выберите характеристику</option>{choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><label><Checkbox disabled={disabled} checked={Boolean(part.signed)} onChange={event => { const parts = [...settingsRead.params.parts]; parts[index] = { source: part.source, ...(event.target.checked ? { signed: true } : {}) }; updateParts(parts); }} />Со знаком</label></>}
              <div className={styles.partActions}><button type="button" disabled={disabled || index === 0} onClick={() => updateParts(reorder(settingsRead.params.parts, index, -1))}>Выше</button><button type="button" disabled={disabled || index === settingsRead.params.parts.length - 1} onClick={() => updateParts(reorder(settingsRead.params.parts, index, 1))}>Ниже</button><button type="button" disabled={disabled} onClick={() => updateParts(settingsRead.params.parts.filter((_, partIndex) => partIndex !== index))}>Удалить</button></div>
            </div>)}
            <div className={styles.inlineActions}><button type="button" disabled={disabled} onClick={() => updateParts([...settingsRead.params.parts, newPart('text')])}>Добавить текст</button><button type="button" disabled={disabled || choices.length === 0} onClick={() => updateParts([...settingsRead.params.parts, newPart('source')])}>Добавить характеристику</button></div>
             <label>Основное значение<Select disabled={disabled} value={referenceValue(settingsRead.params.primary ?? undefined)} onChange={event => { const reference = parseReference(event.target.value); patch({ primary: reference?.kind === 'Base' && partBaseChoices.some(option => option.reference.fieldId === reference.fieldId) ? asJsonReference(reference) : null }); }}><option value="">Только чтение</option>{partBaseChoices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
            </> : settingsRead.type === 'resource' ? <>
              <label>Размер<Select disabled={disabled} value={settingsRead.params.size} onChange={event => patch({ size: event.target.value })}><option value="compact">Компактный</option><option value="medium">Средний</option><option value="large">Большой</option></Select></label>
             <label>Текущее значение<Select disabled={disabled} value={referenceValue(settingsRead.params.current ?? undefined)} onChange={event => { const reference = parseReference(event.target.value); patch({ current: reference ? asJsonReference(reference) : null }); }}><option value="">Выберите характеристику</option>{settingsRead.params.current && !choices.some(option => option.numeric && option.value === referenceValue(settingsRead.params.current!)) && <option value={referenceValue(settingsRead.params.current)}>Сохранённый источник недоступен или имеет другой тип</option>}{choices.filter(option => option.numeric).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
             <label>Максимум<Select disabled={disabled} value={referenceValue(settingsRead.params.maximum ?? undefined)} onChange={event => patch({ maximum: event.target.value ? asJsonReference(parseReference(event.target.value)!) : null })}><option value="">Не задан</option>{settingsRead.params.maximum && !choices.some(option => option.numeric && option.value === referenceValue(settingsRead.params.maximum!)) && <option value={referenceValue(settingsRead.params.maximum)}>Сохранённый максимум недоступен</option>}{choices.filter(option => option.numeric).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
             <label><Checkbox disabled={disabled} checked={settingsRead.params.showBar} onChange={event => patch({ showBar: event.target.checked })} />Показывать шкалу</label>
            </> : settingsRead.type === 'catalog' ? <>
              {campaignId !== undefined ? <PresentationCatalogSettings
                campaignId={campaignId}
                kind={settingsRead.params.kind}
                condition={settingsRead.params.condition}
                disabled={disabled}
                onValidityChange={setCatalogSettingsInvalid}
                onChange={changes => { if (changes.kind !== undefined) setCatalogSettingsInvalid(false); patch(changes as Record<string, JsonValue>); }}
              /> : <StatePanel kind="info">Контекст кампании недоступен.</StatePanel>}
              {catalogSettingsInvalid && <p role="alert">Исправьте условие перед закрытием настроек.</p>}
            </> : <>
             <h4>Характеристики</h4>
             <label>Поиск характеристик<input value={statSearch} disabled={disabled} onChange={event => setStatSearch(event.target.value)} /></label>
             <div className={styles.statChoices}>
                {settingsRead.params.entries.filter(entry => !choices.some(option => referenceValue(option.reference) === referenceValue(entry.source))).map((entry, index) => <label key={`missing-${entry.source.kind}:${entry.source.fieldId}:${index}`}><Checkbox checked disabled={disabled} onChange={() => updateEntries(settingsRead.params.entries.filter(item => item.source.kind !== entry.source.kind || item.source.fieldId !== entry.source.fieldId))} />Характеристика недоступна</label>)}
               {choices.filter(option => option.label.toLocaleLowerCase().includes(statSearch.toLocaleLowerCase())).map(option => {
                 const index = settingsRead.params.entries.findIndex(entry => referenceValue(entry.source) === option.value);
                  return <label key={option.value}><Checkbox disabled={disabled} checked={index >= 0} onChange={event => {
                   if (event.target.checked) { if (index < 0) updateEntries([...settingsRead.params.entries, { source: asJsonReference(option.reference), label: '' }]); }
                   else updateEntries(settingsRead.params.entries.filter(entry => referenceValue(entry.source) !== option.value));
                 }} />{option.label}</label>;
               })}
             </div>
              <>
                <label>Условие отображения<input disabled={disabled} value={settingsRead.params.condition} onChange={event => patch({ condition: event.target.value })} /></label>
                <small>$0 — значение строки. Например: $0 &gt; 0. Остальные характеристики можно раскрыть на листе.</small>
                {statCondition?.error && <span className={styles.diagnostic} role="status">{statCondition.error}</span>}
                <label>Формат вывода<input disabled={disabled} value={settingsRead.params.format} onChange={event => patch({ format: event.target.value })} /></label>
               <small>$0 — исходное значение, $1 и далее — результаты выражений; ${'{1:s}'} выводит со знаком, $$ — знак доллара.</small>
               {statFormat?.error && <span className={styles.diagnostic} role="status">{statFormat.error}</span>}
               <p>В выражениях $0 — значение текущей характеристики. Доступны +, -, *, /, %, floor, ceil, round, abs, min, max.</p>
               {settingsRead.params.expressions.map((expression, index) => expression === null ? null : <div className={styles.expressionEditor} key={index}><span>${index + 1}</span><input aria-label={`Выражение $${index + 1}`} disabled={disabled} value={expression} onChange={event => { const expressions = [...settingsRead.params.expressions]; expressions[index] = event.target.value; patch({ expressions }); }} />{statFormat?.expressionErrors[index] && <span className={styles.diagnostic} role="status">{statFormat.expressionErrors[index]}</span>}<button type="button" disabled={disabled} onClick={() => { const expressions = [...settingsRead.params.expressions]; expressions[index] = null; patch({ expressions }); }}>Удалить</button></div>)}
               <button type="button" disabled={disabled} onClick={() => patch({ expressions: [...settingsRead.params.expressions, ''] })}>Добавить выражение</button>
             </>
              <label>Колонки<Select disabled={disabled} value={settingsRead.params.columns} onChange={event => patch({ columns: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</Select></label>
          </>}
        </div>}
      </ModalPortal>
    </div>
  </section>;
});

export default PresentationEditor;
