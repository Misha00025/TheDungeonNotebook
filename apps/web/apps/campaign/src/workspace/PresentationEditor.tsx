import React, { useMemo, useState } from 'react';
import { isLosslessNumber } from 'lossless-json';
import type { ComputedSheet, FieldReference, JsonValue } from './types';
import { duplicateNode, findNode, insertNode, makeNode, moveNode, moveSibling, patchNodeParams, readParams, removeTreeNode, updateNode, type FieldPart, type PresentationNode, type PresentationType } from './presentationModel';
import PresentationRenderer, { type PresentationDropPlacement } from './PresentationRenderer';
import styles from './Presentation.module.css';

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
const collectGroups = (nodes: PresentationNode[]): PresentationNode[] => nodes.flatMap(node => {
  const params = readParams(node.params);
  return [...(params.status === 'supported' && params.type === 'group' ? [node] : []), ...collectGroups(node.children)];
});
const isDescendant = (node: PresentationNode, key: string): boolean => node.children.some(child => child.nodeKey === key || isDescendant(child, key));
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

const PresentationEditor: React.FC<PresentationEditorProps> = ({ roots, onChange, sheet, choicesSheet, sample = false, disabled = false }) => {
  const [selectedKey, setSelectedKey] = useState('');
  const [preview, setPreview] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'palette' | 'properties'>('properties');
  const selected = selectedKey ? findNode(roots, selectedKey) : undefined;
  const read = selected ? readParams(selected.params) : undefined;
  const choices = useMemo<FieldOption[]>(() => [
    ...(choicesSheet?.baseFields ?? sheet?.baseFields ?? []).map(field => ({ reference: { kind: 'Base' as const, fieldId: field.id }, value: `Base:${encodeURIComponent(field.id)}`, label: `${field.title || field.key} — характеристика`, numeric: field.valueType === 'Integer' || field.valueType === 'Number' })),
    ...(choicesSheet?.virtualFields ?? sheet?.virtualFields ?? []).map(field => ({ reference: { kind: 'Virtual' as const, fieldId: field.id }, value: `Virtual:${encodeURIComponent(field.id)}`, label: `${field.title || field.key} — вычисляемая`, numeric: true })),
  ], [sheet, choicesSheet]);
  const refsFromParts = read?.status === 'supported' && read.type === 'composite' ? read.params.parts.flatMap(part => 'source' in part ? [part.source] : []) : [];
  const partBaseChoices = choices.filter(option => option.reference.kind === 'Base' && refsFromParts.some(reference => reference.kind === 'Base' && reference.fieldId === option.reference.fieldId));

  const patch = (changes: Record<string, JsonValue>) => {
    if (!selected) return;
    const originalParams = isJsonObject(selected.params) ? selected.params : undefined;
    if (read?.status === 'supported' && read.type === 'group' && originalParams?.type === undefined) {
      const params: Record<string, JsonValue> = { ...read.params };
      if (!originalParams) params.legacyParams = selected.params;
      Object.assign(params, changes);
      onChange(updateNode(roots, selected.nodeKey, node => ({ ...node, params })));
      return;
    }
    onChange(updateNode(roots, selected.nodeKey, node => patchNodeParams(node, changes)));
  };
  const patchTitle = (title: string) => selected && onChange(updateNode(roots, selected.nodeKey, node => ({ ...node, title })));
  const add = (type: PresentationType, parentKey: string | null = null, index?: number) => {
    const node = makeNode(type);
    onChange(insertNode(roots, node, parentKey, index)); setSelectedKey(node.nodeKey); setPreview(false); setMobilePanel('properties');
  };
  const moveDrop = (targetKey: string | null, placement: PresentationDropPlacement | 'root', event: React.DragEvent) => {
    if (disabled || preview) return;
    event.preventDefault();
    const source = eventPayload(event);
    if (!source) return;
    const targetPosition = targetKey ? locate(roots, targetKey) : undefined;
    const parentKey = placement === 'root' ? null : placement === 'inside' ? targetKey : targetPosition?.parentKey ?? null;
    const index = placement === 'root' ? roots.length : placement === 'inside' ? (findNode(roots, targetKey!)?.children.length ?? 0) : targetPosition ? targetPosition.index + (placement === 'after' ? 1 : 0) : roots.length;
    if (source.kind === 'palette') add(source.type, parentKey, index);
    else {
      const next = moveNode(roots, source.nodeKey, parentKey, index);
      if (next !== roots) { onChange(next); setSelectedKey(source.nodeKey); }
    }
  };
  const handleRootDrop = (event: React.DragEvent) => {
    event.stopPropagation();
    if (event.defaultPrevented || disabled || preview) return;
    moveDrop(null, 'root', event);
  };
  const configureAs = (type: PresentationType) => {
    if (!selected || !window.confirm(`Настроить компонент как «${palette.find(item => item.type === type)?.label}»? Неизвестные параметры и исходные данные сохранятся.`)) return;
    const defaultsValue = makeNode(type).params;
    const defaults = isJsonObject(defaultsValue) ? defaultsValue : {};
    const source = isJsonObject(selected.params) ? selected.params : { legacyParams: selected.params };
    const reserved = new Set(['version', 'type', 'direction', 'columns', 'gap', 'appearance', 'parts', 'primary', 'current', 'maximum', 'showBar', 'entries', 'legacyFormatError']);
    const unknown = Object.fromEntries(Object.entries(source).filter(([key]) => !reserved.has(key)));
    onChange(updateNode(roots, selected.nodeKey, node => ({ ...node, params: { ...unknown, ...defaults } })));
  };
  const onDropNode = (targetKey: string, placement: PresentationDropPlacement, event: React.DragEvent) => moveDrop(targetKey, placement, event);
  const removeSelected = () => {
    if (!selected) return;
    if (selected.children.length && !window.confirm('Удалить группу вместе со всеми вложенными компонентами?')) return;
    const position = locate(roots, selected.nodeKey);
    onChange(removeTreeNode(roots, selected.nodeKey)); setSelectedKey(position?.siblings[position.index - 1]?.nodeKey ?? position?.siblings[position.index + 1]?.nodeKey ?? '');
  };
  const newPart = (kind: 'text' | 'source'): FieldPart => kind === 'text' ? { text: '' } : { source: asJsonReference(choices[0]?.reference ?? { kind: 'Base', fieldId: '' }) };
  const updateParts = (parts: FieldPart[]) => {
    const primary = read?.status === 'supported' && read.type === 'composite' ? read.params.primary : null;
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
    <header className={styles.editorHeader}><h2>Конструктор отображения</h2><button type="button" disabled={disabled} onClick={() => setPreview(value => !value)}>{preview ? 'Редактировать' : 'Предпросмотр'}</button></header>
    {!preview && <div className={styles.mobilePanelToggle}><button type="button" aria-pressed={mobilePanel === 'palette'} onClick={() => setMobilePanel('palette')}>Компоненты</button><button type="button" aria-pressed={mobilePanel === 'properties'} onClick={() => setMobilePanel('properties')}>Свойства</button></div>}
    <div className={`${styles.editorLayout} ${preview ? styles.previewLayout : ''}`}>
      {!preview && <aside className={`${styles.palette} ${mobilePanel === 'palette' ? styles.mobileActive : ''}`} aria-label="Компоненты">
        <h3>Компоненты</h3>
        {palette.map(item => <button key={item.type} type="button" draggable={!disabled} disabled={disabled} onClick={() => add(item.type, selected && read?.status === 'supported' && read.type === 'group' ? selected.nodeKey : null)} onDragStart={event => event.dataTransfer.setData('application/x-tdn-presentation', JSON.stringify({ kind: 'palette', type: item.type }))}>{item.label}</button>)}
      </aside>}
      <main className={styles.canvasColumn}>
        {!preview && selected && <div className={styles.nodeActions}>
          <button type="button" disabled={disabled || (locate(roots, selected.nodeKey)?.index ?? 0) === 0} onClick={() => { const position = locate(roots, selected.nodeKey); const sibling = position && position.siblings[position.index - 1]; if (sibling) onChange(moveSibling(roots, selected.nodeKey, 'before', sibling.nodeKey)); }}>Выше</button>
          <button type="button" disabled={disabled || !locate(roots, selected.nodeKey) || locate(roots, selected.nodeKey)!.index >= locate(roots, selected.nodeKey)!.siblings.length - 1} onClick={() => { const position = locate(roots, selected.nodeKey); const sibling = position?.siblings[position.index + 1]; if (sibling) onChange(moveSibling(roots, selected.nodeKey, 'after', sibling.nodeKey)); }}>Ниже</button>
          <label>Переместить в группу<select disabled={disabled} value="" onChange={event => { if (event.target.value) onChange(moveNode(roots, selected.nodeKey, event.target.value, findNode(roots, event.target.value)?.children.length ?? 0)); }}><option value="">Выберите группу</option>{collectGroups(roots).filter(group => group.nodeKey !== selected.nodeKey && !isDescendant(selected, group.nodeKey)).map(group => <option key={group.nodeKey} value={group.nodeKey}>{group.title || 'Группа'}</option>)}</select></label>
          <button type="button" disabled={disabled} onClick={() => { const position = locate(roots, selected.nodeKey); onChange(moveNode(roots, selected.nodeKey, null, roots.length)); if (position) setSelectedKey(selected.nodeKey); }}>В корень</button>
          <button type="button" disabled={disabled || !locate(roots, selected.nodeKey)?.parentKey} onClick={() => { const parent = locate(roots, selected.nodeKey)?.parentKey; setSelectedKey(parent ?? ''); }}>Выбрать родителя</button>
          <button type="button" disabled={disabled} onClick={() => onChange(duplicateNode(roots, selected.nodeKey))}>Дублировать</button>
          <button type="button" disabled={disabled} onClick={removeSelected}>Удалить</button>
        </div>}
        <div className={`${styles.canvas} ${roots.length === 0 ? styles.emptyCanvas : ''}`} onDragOver={!preview && !disabled ? event => { if (!event.defaultPrevented) event.preventDefault(); } : undefined} onDrop={!preview && !disabled ? handleRootDrop : undefined}>
          {roots.length === 0 && preview ? <p className={styles.emptyPreview}>Холст пуст</p> : roots.length === 0 ? <div className={styles.emptyState}><p>Холст пока пуст</p><button type="button" disabled={disabled} onClick={() => add('group')}>Добавьте первый компонент</button></div> : <PresentationRenderer roots={roots} sheet={sheet} sample={sample} selectedKey={!preview ? selectedKey : undefined} onSelect={!preview ? key => { setSelectedKey(key); setMobilePanel('properties'); } : undefined} onDropNode={!preview && !disabled ? onDropNode : undefined} />}
          {roots.length > 0 && !preview && <div className={styles.rootDrop} onDragOver={event => { if (!disabled && !event.defaultPrevented) event.preventDefault(); }} onDrop={handleRootDrop}>Переместить в корень</div>}
        </div>
      </main>
      {!preview && <aside className={`${styles.properties} ${mobilePanel === 'properties' ? styles.mobileActive : ''}`} aria-label="Свойства">
        {!selected ? <p>Выберите компонент на холсте.</p> : <>
          <h3>Свойства</h3><label>Название<input value={selected.title} disabled={disabled} onChange={event => patchTitle(event.target.value)} /></label>
          {read?.status !== 'supported' ? <div className={styles.unsupported} role="status"><p>{read?.message}</p><span>Настроить как:</span>{palette.map(item => <button key={item.type} type="button" disabled={disabled} onClick={() => configureAs(item.type)}>{item.label}</button>)}</div> : read.type === 'group' ? <>
            <label>Направление<select disabled={disabled} value={read.params.direction} onChange={event => patch({ direction: event.target.value })}><option value="row">По строке</option><option value="column">По колонкам</option></select></label>
            <label>Колонки<select disabled={disabled} value={read.params.columns} onChange={event => patch({ columns: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Интервал<select disabled={disabled} value={read.params.gap} onChange={event => patch({ gap: event.target.value })}><option value="small">Маленький</option><option value="medium">Средний</option><option value="large">Большой</option></select></label>
            <label>Оформление<select disabled={disabled} value={read.params.appearance} onChange={event => patch({ appearance: event.target.value })}><option value="plain">Простое</option><option value="panel">Панель</option></select></label>
          </> : read.type === 'composite' ? <>
            <h4>Состав</h4>{read.params.parts.map((part, index) => <div className={styles.partEditor} key={index}>
              {'text' in part ? <><span>Текст</span><input aria-label={`Текст, часть ${index + 1}`} disabled={disabled} value={part.text} onChange={event => { const parts = [...read.params.parts]; parts[index] = { text: event.target.value }; updateParts(parts); }} /></> : <><span>Характеристика</span><select aria-label={`Характеристика, часть ${index + 1}`} disabled={disabled} value={referenceValue(part.source)} onChange={event => { const reference = parseReference(event.target.value); if (!reference) return; const parts = [...read.params.parts]; parts[index] = { source: asJsonReference(reference), ...(part.signed ? { signed: true } : {}) }; updateParts(parts); }}><option value="">Выберите характеристику</option>{choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label><input type="checkbox" disabled={disabled} checked={Boolean(part.signed)} onChange={event => { const parts = [...read.params.parts]; parts[index] = { source: part.source, ...(event.target.checked ? { signed: true } : {}) }; updateParts(parts); }} />Со знаком</label></>}
              <div className={styles.partActions}><button type="button" disabled={disabled || index === 0} onClick={() => updateParts(reorder(read.params.parts, index, -1))}>Выше</button><button type="button" disabled={disabled || index === read.params.parts.length - 1} onClick={() => updateParts(reorder(read.params.parts, index, 1))}>Ниже</button><button type="button" disabled={disabled} onClick={() => updateParts(read.params.parts.filter((_, partIndex) => partIndex !== index))}>Удалить</button></div>
            </div>)}
            <div className={styles.inlineActions}><button type="button" disabled={disabled} onClick={() => updateParts([...read.params.parts, newPart('text')])}>Добавить текст</button><button type="button" disabled={disabled || choices.length === 0} onClick={() => updateParts([...read.params.parts, newPart('source')])}>Добавить характеристику</button></div>
            <label>Основное значение<select disabled={disabled} value={referenceValue(read.params.primary ?? undefined)} onChange={event => { const reference = parseReference(event.target.value); patch({ primary: reference?.kind === 'Base' && partBaseChoices.some(option => option.reference.fieldId === reference.fieldId) ? asJsonReference(reference) : null }); }}><option value="">Только чтение</option>{partBaseChoices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </> : read.type === 'resource' ? <>
            <label>Текущее значение<select disabled={disabled} value={referenceValue(read.params.current ?? undefined)} onChange={event => { const reference = parseReference(event.target.value); patch({ current: reference ? asJsonReference(reference) : null }); }}><option value="">Выберите характеристику</option>{read.params.current && !choices.some(option => option.numeric && option.value === referenceValue(read.params.current!)) && <option value={referenceValue(read.params.current)}>Сохранённый источник недоступен или имеет другой тип</option>}{choices.filter(option => option.numeric).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Максимум<select disabled={disabled} value={referenceValue(read.params.maximum ?? undefined)} onChange={event => patch({ maximum: event.target.value ? asJsonReference(parseReference(event.target.value)!) : null })}><option value="">Не задан</option>{read.params.maximum && !choices.some(option => option.numeric && option.value === referenceValue(read.params.maximum!)) && <option value={referenceValue(read.params.maximum)}>Сохранённый максимум недоступен</option>}{choices.filter(option => option.numeric).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><input type="checkbox" disabled={disabled} checked={read.params.showBar} onChange={event => patch({ showBar: event.target.checked })} />Показывать шкалу</label>
          </> : <>
            <h4>Характеристики</h4>{read.params.entries.map((entry, index) => <div className={styles.entryEditor} key={`${entry.source.kind}:${entry.source.fieldId}:${index}`}>
              <label>Источник<select disabled={disabled} value={referenceValue(entry.source)} onChange={event => { const reference = parseReference(event.target.value); if (!reference) return; const entries = [...read.params.entries]; entries[index] = { ...entry, source: asJsonReference(reference) }; updateEntries(entries); }}><option value="">Выберите характеристику</option>{choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>Подпись<input disabled={disabled} value={entry.label} onChange={event => { const entries = [...read.params.entries]; entries[index] = { ...entry, label: event.target.value }; updateEntries(entries); }} /></label>
              <div className={styles.partActions}><button type="button" disabled={disabled || index === 0} onClick={() => updateEntries(reorder(read.params.entries, index, -1))}>Выше</button><button type="button" disabled={disabled || index === read.params.entries.length - 1} onClick={() => updateEntries(reorder(read.params.entries, index, 1))}>Ниже</button><button type="button" disabled={disabled} onClick={() => updateEntries(read.params.entries.filter((_, entryIndex) => entryIndex !== index))}>Удалить</button></div>
            </div>)}
            <button type="button" disabled={disabled || choices.length === 0} onClick={() => updateEntries([...read.params.entries, { source: asJsonReference(choices[0].reference), label: '' }])}>Добавить характеристику</button>
            <label>Колонки<select disabled={disabled} value={read.params.columns} onChange={event => patch({ columns: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</select></label>
          </>}
        </>}
      </aside>}
    </div>
  </section>;
};

export default PresentationEditor;
