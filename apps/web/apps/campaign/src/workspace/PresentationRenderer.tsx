import React, { useState } from 'react';
import { isLosslessNumber } from 'lossless-json';
import type { ComputedSheet, FieldReference, JsonValue } from './types';
import { displayValue } from './json';
import { readParams, type FieldPart, type PresentationNode } from './presentationModel';
import styles from './Presentation.module.css';

export type ResolvedField =
  | { status: 'value'; reference: FieldReference; label: string; value: JsonValue; valueType: string; sampleValue: JsonValue; sampleLabel?: string }
  | { status: 'missing'; reference: FieldReference; label: string; message: string; valueType?: string }
  | { status: 'diagnostic'; reference: FieldReference; label: string; message: string; valueType?: string };
export type PresentationDropPlacement = 'before' | 'after' | 'inside';
export type PresentationRendererProps = {
  roots: PresentationNode[];
  sheet?: ComputedSheet;
  sample?: boolean;
  renderValue?: (reference: FieldReference, label: string, display?: React.ReactNode) => React.ReactNode;
  selectedKey?: string;
  onSelect?: (nodeKey: string) => void;
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

const NodeContent: React.FC<{ node: PresentationNode; sheet?: ComputedSheet; sample: boolean; renderValue?: PresentationRendererProps['renderValue']; selectedKey?: string; onSelect?: PresentationRendererProps['onSelect']; onDropNode?: PresentationRendererProps['onDropNode']; renderNodeActions?: PresentationRendererProps['renderNodeActions'] }> = ({ node, sheet, sample, renderValue, selectedKey, onSelect, onDropNode, renderNodeActions }) => {
  const [dropActive, setDropActive] = useState(false);
  const read = readParams(node.params);
  const params = read.status === 'supported' ? read.params : undefined;
  const select = (event: React.MouseEvent | React.KeyboardEvent) => { event.stopPropagation(); onSelect?.(node.nodeKey); };
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(event); } };
  const drop = (placement: PresentationDropPlacement) => <div className={`${styles.dropZone} ${placement === 'before' ? styles.dropBefore : placement === 'after' ? styles.dropAfter : styles.dropInside}`} onDragOver={event => { event.preventDefault(); event.stopPropagation(); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); onDropNode?.(node.nodeKey, placement, event); setDropActive(false); }}>{placement === 'inside' ? 'Внутрь' : placement === 'before' ? 'Перед' : 'После'}</div>;
  let body: React.ReactNode = null;
  if (params?.type === 'group') {
    body = <div className={`${styles.children} ${params.direction === 'row' ? styles.rowChildren : styles.groupChildren}`} style={{ '--presentation-columns': String(params.columns), display: params.direction === 'row' ? 'flex' : 'grid', flexDirection: params.direction === 'row' ? 'row' : undefined, flexWrap: params.direction === 'row' ? 'wrap' : undefined, gap: params.gap === 'small' ? '.5rem' : params.gap === 'large' ? '1.5rem' : '1rem' } as React.CSSProperties}>
      {node.children.map(child => <NodeContent key={child.nodeKey} node={child} sheet={sheet} sample={sample} renderValue={renderValue} selectedKey={selectedKey} onSelect={onSelect} onDropNode={onDropNode} renderNodeActions={renderNodeActions} />)}
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
    body = <div className={styles.composite}>
      {renderEditable && !sample && primary && primaryResult ? renderValue!(primary, primaryResult.label, formattedParts) : formattedParts}
    </div>;
  } else if (params?.type === 'resource') {
    const current = params.current ? resolveField(sheet, params.current) : undefined;
    const maximum = params.maximum ? resolveField(sheet, params.maximum) : undefined;
    const currentNumeric = current?.status === 'value' && numericType(current.valueType);
    const maximumNumeric = maximum?.status === 'value' && numericType(maximum.valueType);
    const currentEditable = Boolean(!sample && params.current?.kind === 'Base' && currentNumeric && renderValue);
    const currentValue = sample && current?.status === 'value' && numericType(current.valueType) ? current.sampleValue : current?.status === 'value' ? current.value : undefined;
    const maximumValue = sample && maximum?.status === 'value' && numericType(maximum.valueType) ? maximum.sampleValue : maximum?.status === 'value' ? maximum.value : undefined;
    const numericCurrent = currentValue !== undefined && isNumeric(currentValue) ? Number(String(currentValue)) : undefined;
    const numericMaximum = maximumValue !== undefined && isNumeric(maximumValue) ? Number(String(maximumValue)) : undefined;
    const hasValidMaximum = currentNumeric && maximumNumeric && numericCurrent !== undefined && numericMaximum !== undefined && Number.isFinite(numericCurrent) && Number.isFinite(numericMaximum) && numericMaximum > 0;
    const barWidth = hasValidMaximum && numericCurrent !== undefined && numericMaximum !== undefined ? Math.max(0, Math.min(100, numericCurrent / numericMaximum * 100)) : undefined;
    body = <div className={styles.resource}>
      <div className={styles.resourceValues}><div>{current?.status === 'value' && !currentNumeric ? <span className={styles.diagnostic}>Для ресурса нужна числовая характеристика.</span> : currentEditable && params.current && current?.status === 'value' ? renderValue!(params.current, current.label, displayResolved(current, sample)) : current ? displayResolved(current, sample) : <span className={styles.placeholder}>Выберите характеристику</span>}</div>
        {params.maximum ? <><span className={styles.resourceSeparator} aria-hidden="true">/</span><div>{maximum?.status === 'value' && !maximumNumeric ? <span className={styles.diagnostic}>Максимум должен быть числовым.</span> : maximum ? displayResolved(maximum, sample) : <span className={styles.placeholder}>Максимум недоступен</span>}</div></> : null}</div>
      {params.showBar && hasValidMaximum && <div className={styles.progressTrack} role="img" aria-label={sample ? 'Образец соотношения текущего значения и максимума' : 'Соотношение текущего значения и максимума'}><span style={{ width: `${barWidth}%` }} /></div>}
    </div>;
  } else if (params?.type === 'stat-list') {
    body = <div className={styles.statList} style={{ '--presentation-columns': String(params.columns) } as React.CSSProperties}>{params.entries.map((entry, index) => {
      const field = resolveField(sheet, entry.source);
      const label = entry.label || field.label;
      return <div className={styles.statRow} key={`${entry.source.kind}:${entry.source.fieldId}:${index}`}><span>{label}</span>{!sample && entry.source.kind === 'Base' && field.status === 'value' && renderValue ? renderValue(entry.source, label, displayResolved(field, sample)) : displayResolved(field, sample)}</div>;
    })}{sample && params.entries.length === 0 && <span className={styles.placeholder}>Выберите характеристику</span>}</div>;
  }
  const groupAppearance = params?.type === 'group' && params.appearance === 'panel';
  const nestedChildren = params?.type !== 'group' && node.children.length > 0 ? <div className={styles.children}>{node.children.map(child => <NodeContent key={child.nodeKey} node={child} sheet={sheet} sample={sample} renderValue={renderValue} selectedKey={selectedKey} onSelect={onSelect} onDropNode={onDropNode} renderNodeActions={renderNodeActions} />)}</div> : null;
  return <article className={`${styles.node} ${groupAppearance ? styles.panel : ''} ${selectedKey === node.nodeKey ? styles.selected : ''}`} data-drag-active={dropActive || undefined} tabIndex={onSelect ? 0 : undefined} draggable={Boolean(onDropNode)} aria-label={node.title || 'Компонент отображения'} onDragStart={event => { event.stopPropagation(); if (onDropNode) event.dataTransfer.setData('application/x-tdn-presentation', JSON.stringify({ kind: 'node', nodeKey: node.nodeKey })); }} onDragOver={onDropNode ? event => { event.preventDefault(); event.stopPropagation(); setDropActive(true); } : undefined} onDragLeave={onDropNode ? event => { event.stopPropagation(); if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false); } : undefined} onClick={onSelect ? select : undefined} onKeyDown={onSelect ? onKeyDown : undefined}>
    {Boolean(onDropNode) && <>{drop('before')}</>}
      {selectedKey === node.nodeKey && renderNodeActions && <div className={styles.nodeControls} role="group" aria-label="Действия компонента" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }} onDrag={event => event.stopPropagation()} onDragEnd={event => event.stopPropagation()} onDragEnter={event => event.stopPropagation()} onDragOver={event => event.stopPropagation()} onDragLeave={event => event.stopPropagation()} onDrop={event => event.stopPropagation()}>{renderNodeActions(node)}</div>}
      {node.title && <h3 className={styles.nodeTitle}>{node.title}</h3>}
      {read.status !== 'supported' ? <p className={styles.diagnostic} role="status">{read.message}</p> : <>{body}{nestedChildren}</>}
    {read.status !== 'supported' && node.children.length > 0 && <div className={styles.children}>{node.children.map(child => <NodeContent key={child.nodeKey} node={child} sheet={sheet} sample={sample} renderValue={renderValue} selectedKey={selectedKey} onSelect={onSelect} onDropNode={onDropNode} renderNodeActions={renderNodeActions} />)}</div>}
    {Boolean(onDropNode) && <>{drop('after')}{params?.type === 'group' && drop('inside')}</>}
  </article>;
};

const PresentationRenderer: React.FC<PresentationRendererProps> = ({ roots, sheet, sample = false, renderValue, selectedKey, onSelect, onDropNode, renderNodeActions }) => <div className={styles.roots}>
  {roots.map(node => <NodeContent key={node.nodeKey} node={node} sheet={sheet} sample={sample} renderValue={renderValue} selectedKey={selectedKey} onSelect={onSelect} onDropNode={onDropNode} renderNodeActions={renderNodeActions} />)}
</div>;

export default PresentationRenderer;
