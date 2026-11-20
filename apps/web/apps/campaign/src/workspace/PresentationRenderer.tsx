import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { isLosslessNumber } from 'lossless-json';
import type { ComputedSheet, FieldReference, JsonValue } from './types';
import { displayValue } from './json';
import { readParams, type FieldPart, type PresentationNode } from './presentationModel';
import styles from './Presentation.module.css';
import { compileStatListCondition, compileStatListFormat } from './statListFormat';

export type ResolvedField =
  | { status: 'value'; reference: FieldReference; label: string; value: JsonValue; valueType: string; sampleValue: JsonValue; sampleLabel?: string }
  | { status: 'missing'; reference: FieldReference; label: string; message: string; valueType?: string }
  | { status: 'diagnostic'; reference: FieldReference; label: string; message: string; valueType?: string };
export type PresentationDropPlacement = 'before' | 'after' | 'inside';
type DropMarker = (element: HTMLElement, placement: PresentationDropPlacement | null) => void;
export type PresentationRendererProps = {
  roots: PresentationNode[];
  sheet?: ComputedSheet;
  conditionSheet?: ComputedSheet;
  sample?: boolean;
  renderValue?: (reference: FieldReference, label: string, display?: React.ReactNode) => React.ReactNode;
  onDropNode?: (targetKey: string, placement: PresentationDropPlacement, event: React.DragEvent) => void;
  renderNodeActions?: (node: PresentationNode) => React.ReactNode;
};

const isNumeric = (value: JsonValue): boolean => typeof value === 'number' ? Number.isFinite(value) : isLosslessNumber(value) && /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(String(value));
const numericSample = (type: string): JsonValue => type === 'Integer' ? 12 : type === 'Number' ? 12.5 : type === 'Boolean' ? true : type === 'String' ? 'Пример текста' : type === 'MultiChoice' ? [] : 'Пример';
const sampleText = (resolved: Extract<ResolvedField, { status: 'value' }>) => resolved.sampleLabel ?? displayValue(resolved.sampleValue);
const numericType = (type: string | undefined): boolean => type === 'Integer' || type === 'Number';
const fieldTitle = (field: { title: string; key: string }) => field.title || field.key;

export function resolveField(sheet: ComputedSheet | undefined, reference: FieldReference): ResolvedField {
  if (!sheet) return { status: 'missing', reference, label: 'Характеристика', message: 'Данные листа недоступны.' };
  if (reference.kind === 'Base') {
    const field = sheet.baseFields.find(item => item.id === reference.fieldId);
    if (!field) return { status: 'missing', reference, label: 'Характеристика', message: 'Характеристика недоступна.' };
    const sampleOption = field.valueType === 'SingleChoice' ? field.options[0] : undefined;
    const sampleValue = field.valueType === 'SingleChoice' ? sampleOption?.optionKey ?? '' : numericSample(field.valueType);
    return { status: 'value', reference, label: fieldTitle(field), value: field.effectiveValue, valueType: field.valueType, sampleValue, ...(field.valueType === 'SingleChoice' ? { sampleLabel: sampleOption?.title || 'Выберите вариант' } : {}) };
  }
  const field = sheet.virtualFields.find(item => item.id === reference.fieldId);
  if (!field) return { status: 'missing', reference, label: 'Характеристика', message: 'Характеристика недоступна.' };
  if (field.diagnostic) return { status: 'diagnostic', reference, label: fieldTitle(field), message: 'Не удалось вычислить характеристику.', valueType: field.resultType };
  return { status: 'value', reference, label: fieldTitle(field), value: field.value, valueType: field.resultType, sampleValue: numericSample(field.resultType) };
}

function displayResolved(resolved: ResolvedField, sample: boolean): React.ReactNode {
  if (sample) {
    if (resolved.status === 'missing') return <span className={styles.placeholder}>Выберите характеристику</span>;
    if (resolved.status === 'diagnostic') return <span className={styles.diagnostic}>Недоступно</span>;
    return <span className={styles.sampleValue}>{sampleText(resolved)}<span className={styles.sampleMark}>Образец</span></span>;
  }
  if (resolved.status === 'missing') return <span className={styles.placeholder}>{resolved.message}</span>;
  if (resolved.status === 'diagnostic') return <span className={styles.diagnostic}>{resolved.message}</span>;
  return <span className={styles.value}>{resolved.value === '' ? "''" : displayValue(resolved.value)}</span>;
}

function valueForPart(part: FieldPart, sheet: ComputedSheet | undefined, sample: boolean): { text?: string; label?: string; error?: string } {
  if ('text' in part) return { text: part.text };
  const result = resolveField(sheet, part.source);
  if (result.status === 'missing') return { label: result.label, error: result.message };
  if (result.status === 'diagnostic') return { label: result.label, error: result.message };
  if (part.signed) {
    if ((result.valueType !== 'Integer' && result.valueType !== 'Number') || (!sample && !isNumeric(result.value))) return { label: result.label, error: 'Источник не является числом.' };
    const text = String(sample ? result.sampleValue : result.value);
    return { label: result.label, text: text.startsWith('-') || text.startsWith('+') ? text : `+${text}` };
  }
  if (sample) return { label: result.label, text: sampleText(result) };
  return { label: result.label, text: result.value === '' ? "''" : displayValue(result.value) };
}

const NodeContent: React.FC<{ node: PresentationNode; sheet?: ComputedSheet; conditionSheet?: ComputedSheet; sample: boolean; renderValue?: PresentationRendererProps['renderValue']; onDropNode?: PresentationRendererProps['onDropNode']; onDropMarker?: DropMarker; renderNodeActions?: PresentationRendererProps['renderNodeActions']; orientation?: 'row' | 'column' }> = React.memo(({ node, sheet, conditionSheet, sample, renderValue, onDropNode, onDropMarker, renderNodeActions, orientation }) => {
  const read = useMemo(() => readParams(node.params), [node.params]);
  const params = read.status === 'supported' ? read.params : undefined;
  const statFormat = useMemo(() => params?.type === 'stat-list' ? compileStatListFormat(params.format, params.expressions) : undefined, [node.params]);
  const statCondition = useMemo(() => params?.type === 'stat-list' ? compileStatListCondition(params.condition) : undefined, [node.params]);
  const placementAt = (element: HTMLElement, event: Pick<React.DragEvent, 'clientX' | 'clientY'>): PresentationDropPlacement => {
    const rect = element.getBoundingClientRect();
    const horizontal = orientation === 'row';
    const ratio = horizontal ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
    return params?.type === 'group' ? ratio < .25 ? 'before' : ratio > .75 ? 'after' : 'inside' : ratio < .5 ? 'before' : 'after';
  };
  const onDropOver = (event: React.DragEvent<HTMLElement>) => {
    if (!onDropNode || !onDropMarker) return;
    if (!Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation')) { onDropMarker(event.currentTarget, null); return; }
    event.preventDefault();
    event.stopPropagation();
    onDropMarker(event.currentTarget, placementAt(event.currentTarget, event));
  };
  const body = useMemo(() => {
  let content: React.ReactNode = null;
  if (params?.type === 'group') {
    content = <div className={`${styles.children} ${params.direction === 'row' ? styles.rowChildren : styles.groupChildren}`} style={{ '--presentation-columns': String(params.columns), display: params.direction === 'row' ? 'flex' : 'grid', flexDirection: params.direction === 'row' ? 'row' : undefined, flexWrap: params.direction === 'row' ? 'wrap' : undefined, gap: params.gap === 'small' ? '.5rem' : params.gap === 'large' ? '1.5rem' : '1rem' } as React.CSSProperties}>
      {node.children.map(child => <NodeContent key={child.nodeKey} node={child} sheet={sheet} conditionSheet={conditionSheet} sample={sample} renderValue={renderValue} onDropNode={onDropNode} onDropMarker={onDropMarker} renderNodeActions={renderNodeActions} orientation={params.direction} />)}
    </div>;
  } else if (params?.type === 'composite') {
    const primary = params.primary && params.primary.kind === 'Base' && params.parts.some(part => 'source' in part && part.source.kind === 'Base' && part.source.fieldId === params.primary?.fieldId) ? params.primary : null;
    const primaryResult = primary ? resolveField(sheet, primary) : undefined;
    const renderEditable = Boolean(primary && primaryResult?.status === 'value' && renderValue && params.parts.some(part => 'source' in part && part.source.kind === 'Base' && part.source.fieldId === primary.fieldId));
    const partsContent = params.parts.map((part, index) => {
        const value = valueForPart(part, sheet, sample);
        if ('text' in part) return <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>;
        return <span key={`source-${index}`} className={value.error ? styles.diagnostic : styles.compositeValue}>{value.text !== undefined ? <>{value.text}{sample && <span className={styles.sampleMark}>Образец</span>}</> : sample ? <span className={styles.placeholder}>Выберите характеристику</span> : value.error}</span>;
      });
    const formattedParts = <span className={styles.compositeParts}>{partsContent}</span>;
     content = <div className={styles.composite}>
      {renderEditable && !sample && primary && primaryResult ? renderValue!(primary, primaryResult.label, formattedParts) : formattedParts}
    </div>;
  } else if (params?.type === 'resource') {
    const current = params.current ? resolveField(sheet, params.current) : undefined;
    const maximum = params.maximum ? resolveField(sheet, params.maximum) : undefined;
    const currentNumeric = current?.status === 'value' && numericType(current.valueType);
    const maximumNumeric = maximum?.status === 'value' && numericType(maximum.valueType);
    const currentEditable = Boolean(!sample && params.current?.kind === 'Base' && currentNumeric && renderValue);
    const maximumEditable = Boolean(!sample && params.maximum?.kind === 'Base' && maximumNumeric && renderValue);
    const currentValue = sample && current?.status === 'value' && numericType(current.valueType) ? current.sampleValue : current?.status === 'value' ? current.value : undefined;
    const maximumValue = sample && maximum?.status === 'value' && numericType(maximum.valueType) ? maximum.sampleValue : maximum?.status === 'value' ? maximum.value : undefined;
    const numericCurrent = currentValue !== undefined && isNumeric(currentValue) ? Number(String(currentValue)) : undefined;
    const numericMaximum = maximumValue !== undefined && isNumeric(maximumValue) ? Number(String(maximumValue)) : undefined;
    const hasValidMaximum = currentNumeric && maximumNumeric && numericCurrent !== undefined && numericMaximum !== undefined && Number.isFinite(numericCurrent) && Number.isFinite(numericMaximum) && numericMaximum > 0;
    const barWidth = hasValidMaximum && numericCurrent !== undefined && numericMaximum !== undefined ? Math.max(0, Math.min(100, numericCurrent / numericMaximum * 100)) : undefined;
    content = <div className={styles.resource}>
       <div className={styles.resourceValues}><div className={styles.resourceCurrent}>{current?.status === 'value' && !currentNumeric ? <span className={styles.diagnostic}>Для ресурса нужна числовая характеристика.</span> : currentEditable && params.current && current?.status === 'value' ? renderValue!(params.current, current.label, displayResolved(current, sample)) : current ? displayResolved(current, sample) : <span className={styles.placeholder}>Выберите характеристику</span>}</div>
          {params.maximum ? <><span className={styles.resourceSeparator} aria-hidden="true">/</span><div className={styles.resourceMaximum}>{maximum?.status === 'value' && !maximumNumeric ? <span className={styles.diagnostic}>Максимум должен быть числовым.</span> : maximumEditable && maximum?.status === 'value' ? renderValue!(params.maximum, maximum.label, displayResolved(maximum, sample)) : maximum ? displayResolved(maximum, sample) : <span className={styles.placeholder}>Максимум недоступен</span>}</div></> : null}</div>
      {params.showBar && hasValidMaximum && <div className={styles.progressTrack} role="img" aria-label={sample ? 'Образец соотношения текущего значения и максимума' : 'Соотношение текущего значения и максимума'}><span style={{ width: `${barWidth}%` }} /></div>}
    </div>;
  } else if (params?.type === 'stat-list') {
    const mainRows: React.ReactNode[] = [];
    const hiddenRows: React.ReactNode[] = [];
    params.entries.forEach((entry, index) => {
      const field = resolveField(sheet, entry.source);
      const conditionField = resolveField(conditionSheet ?? sheet, entry.source);
      const label = entry.label || field.label;
      const key = `${entry.source.kind}:${entry.source.fieldId}:${index}`;
      if (field.status !== 'value') {
         mainRows.push(<div className={styles.statRow} key={key}><span className={styles.statLabel}>{label}</span><span className={styles.statValue}>{displayResolved(field, sample)}</span></div>);
        return;
      }
      const sourceValue = sample ? field.sampleValue : field.value;
      const displayText = sample ? sampleText(field) : field.value === '' ? "''" : displayValue(field.value);
      const formatted = statFormat?.render(sourceValue, displayText) ?? { text: displayText };
      const valueDisplay = 'error' in formatted ? <span className={styles.diagnostic}>{formatted.error}</span> : <span className={styles.value}>{formatted.text}{sample && <span className={styles.sampleMark}>Образец</span>}</span>;
      const predicate = sample ? statCondition?.test(sourceValue) : conditionField.status === 'value' ? statCondition?.test(conditionField.value) : undefined;
      const rowValue = predicate?.error && !statCondition?.error ? <>{valueDisplay}<span className={styles.diagnostic}>Условие отображения не удалось вычислить.</span></> : valueDisplay;
       const row = <div className={styles.statRow} key={key}><span className={styles.statLabel}>{label}</span><span className={styles.statValue}>{!sample && entry.source.kind === 'Base' && renderValue ? renderValue(entry.source, label, rowValue) : rowValue}</span></div>;
      if (predicate?.matches === false) hiddenRows.push(row);
      else mainRows.push(row);
    });
    const gridStyle = { '--presentation-columns': String(params.columns) } as React.CSSProperties;
    content = <>
      {statCondition?.error && <p className={styles.diagnostic} role="status">{statCondition.error}</p>}
      <div className={styles.statList} style={gridStyle}>{mainRows}{sample && params.entries.length === 0 && <span className={styles.placeholder}>Выберите характеристику</span>}</div>
      {hiddenRows.length > 0 && <details><summary>Остальные характеристики ({hiddenRows.length})</summary><div className={styles.statList} style={gridStyle}>{hiddenRows}</div></details>}
    </>;
  }
  return content;
  }, [node.params, node.children, sheet, conditionSheet, sample, renderValue, onDropNode, onDropMarker, renderNodeActions, read, params, statFormat, statCondition]);
  const groupAppearance = params?.type === 'group' && params.appearance === 'panel';
  const nestedChildren = params?.type !== 'group' && node.children.length > 0 ? <div className={styles.children}>{node.children.map(child => <NodeContent key={child.nodeKey} node={child} sheet={sheet} conditionSheet={conditionSheet} sample={sample} renderValue={renderValue} onDropNode={onDropNode} onDropMarker={onDropMarker} renderNodeActions={renderNodeActions} />)}</div> : null;
  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    const ownMime = Array.from(event.dataTransfer.types).includes('application/x-tdn-presentation');
    if (!onDropNode || !onDropMarker || !ownMime) { onDropMarker?.(event.currentTarget, null); return; }
    event.preventDefault();
    onDropNode(node.nodeKey, placementAt(event.currentTarget, event), event);
    onDropMarker(event.currentTarget, null);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    const related = event.relatedTarget;
    if (!(related instanceof Node) || !event.currentTarget.contains(related)) onDropMarker?.(event.currentTarget, null);
  };
  return <article className={`${styles.node} ${groupAppearance ? styles.panel : ''}`} data-drop-axis={orientation === 'row' ? 'x' : 'y'} tabIndex={renderNodeActions ? 0 : undefined} draggable={Boolean(onDropNode)} aria-label={node.title || 'Компонент отображения'} onDragStart={event => { event.stopPropagation(); if (onDropNode) event.dataTransfer.setData('application/x-tdn-presentation', JSON.stringify({ kind: 'node', nodeKey: node.nodeKey })); }} onDragOver={onDropOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {renderNodeActions && <div className={styles.nodeControls} role="group" aria-label="Действия компонента" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }} onDragOver={event => event.stopPropagation()} onDragLeave={event => event.stopPropagation()} onDrop={event => { event.preventDefault(); event.stopPropagation(); const nodeElement = event.currentTarget.parentElement; if (nodeElement instanceof HTMLElement) onDropMarker?.(nodeElement, null); }} onDragEnd={event => event.stopPropagation()}>{renderNodeActions(node)}</div>}
      {node.title && <h3 className={styles.nodeTitle}>{node.title}</h3>}
      {read.status !== 'supported' ? <p className={styles.diagnostic} role="status">{read.message}</p> : <>{body}{nestedChildren}</>}
       {read.status !== 'supported' && node.children.length > 0 && <div className={styles.children}>{node.children.map(child => <NodeContent key={child.nodeKey} node={child} sheet={sheet} conditionSheet={conditionSheet} sample={sample} renderValue={renderValue} onDropNode={onDropNode} onDropMarker={onDropMarker} renderNodeActions={renderNodeActions} />)}</div>}
   </article>;
});

const PresentationRenderer: React.FC<PresentationRendererProps> = React.memo(({ roots, sheet, conditionSheet, sample = false, renderValue, onDropNode, renderNodeActions }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const markDrop = useCallback((element: HTMLElement, placement: PresentationDropPlacement | null) => {
    if (placement === null) {
      const active = activeTargetRef.current;
      if (active && (active === element || element.contains(active))) {
        active.removeAttribute('data-drop-placement');
        activeTargetRef.current = null;
      }
      return;
    }
    if (activeTargetRef.current !== element) {
      activeTargetRef.current?.removeAttribute('data-drop-placement');
      activeTargetRef.current = element;
    }
    if (element.getAttribute('data-drop-placement') !== placement) element.setAttribute('data-drop-placement', placement);
  }, []);
  useEffect(() => {
    if (!onDropNode) return;
    const clear = () => { const active = activeTargetRef.current; if (active) markDrop(active, null); };
    const handleDragOver = (event: DragEvent) => {
      const target = event.target;
      const inside = target instanceof Node && Boolean(rootRef.current?.contains(target));
      const ownMime = Array.from(event.dataTransfer?.types ?? []).includes('application/x-tdn-presentation');
      if (!inside || !ownMime) clear();
    };
    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('drop', clear, true);
    document.addEventListener('dragend', clear, true);
    return () => {
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('drop', clear, true);
      document.removeEventListener('dragend', clear, true);
      clear();
    };
  }, [onDropNode, markDrop]);
  const marker = onDropNode ? markDrop : undefined;
  return <div className={styles.roots} ref={rootRef}>
     {roots.map(node => <NodeContent key={node.nodeKey} node={node} sheet={sheet} conditionSheet={conditionSheet} sample={sample} renderValue={renderValue} onDropNode={onDropNode} onDropMarker={marker} renderNodeActions={renderNodeActions} />)}
  </div>;
});

export default PresentationRenderer;
