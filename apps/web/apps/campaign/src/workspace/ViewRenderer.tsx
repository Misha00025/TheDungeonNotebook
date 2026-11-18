import React from 'react';
import { LosslessNumber } from 'lossless-json';
import type { JsonValue, ViewNode, ViewSourcesResponse } from './types';
import { displayValue } from './json';
import { diagnosticMessage } from './displayDiagnostics';
import commonStyles from '@tdn/shared/styles/common.module.css';
import styles from './ViewRenderer.module.css';

type Source = ViewSourcesResponse['widgets'][number]['sources'][number];

export function formatWidget(format: string, sources: Source[]): { text: string; error?: string } {
  if (format === '') return { text: '' };
  const byIndex = new Map(sources.map(source => [source.sourceIndex, source]));
  let text = '';
  for (let i = 0; i < format.length;) {
    if (format[i] !== '$') { text += format[i++]; continue; }
    if (format[i + 1] === '$') { text += '$'; i += 2; continue; }
    const token = format.slice(i).match(/^\$(\d+)|^\$\{(\d+):s\}/);
    if (!token) return { text: '', error: `Некорректный формат виджета у символа ${i + 1}.` };
    const placeholder = Number(token[1] ?? token[2]);
    if (!Number.isSafeInteger(placeholder) || placeholder < 1) return { text: '', error: `Некорректный индекс источника у символа ${i + 1}.` };
    const index = placeholder - 1;
    const source = byIndex.get(index);
    if (!source) return { text: '', error: `Источник $${placeholder} отсутствует.` };
    if (source.diagnostic) return { text: '', error: source.diagnostic.code };
    const value = source.value;
    if (token[2] !== undefined) {
      if (typeof value !== 'number' && !(value instanceof LosslessNumber)) return { text: '', error: `Источник $${placeholder} не является числом.` };
      const numeric = String(value);
      text += numeric.startsWith('-') || numeric.startsWith('+') ? numeric : `+${numeric}`;
    } else text += displayValue(value);
    i += token[0].length;
  }
  return { text };
}

type Props = { roots: ViewNode[]; widgets: ViewSourcesResponse['widgets'] };

const NodeView: React.FC<{ node: ViewNode; widgets: Props['widgets'] }> = ({ node, widgets }) => {
  const params = node.params && typeof node.params === 'object' && !(node.params instanceof LosslessNumber) && !Array.isArray(node.params) ? node.params as Record<string, JsonValue> : undefined;
  const direction = params?.direction === 'row' || params?.direction === 'column' ? params.direction : 'column';
  const widget = widgets.find(item => item.nodeKey === node.nodeKey);
  const formatted = node.kind === 'widget' ? formatWidget(node.format, widget?.sources ?? []) : undefined;
  const formattedDiagnosticIsListed = Boolean(formatted?.error && widget?.sources.some(source => source.diagnostic?.code === formatted.error));
  const missingSources = node.kind === 'widget' ? node.sources.map((_, index) => index).filter(index => !widget?.sources.some(source => source.sourceIndex === index)) : [];
  return <article className={`${commonStyles.card} ${styles.node}`}>
    <h3>{node.title}</h3>
    {node.kind === 'widget' && (formatted?.error ? !formattedDiagnosticIsListed && <p role="alert">{formatted.error}</p> : <output>{formatted?.text}</output>)}
    {node.kind === 'widget' && !widget && <p role="alert">Источники виджета недоступны.</p>}
    {missingSources.map(index => <p role="alert" key={`missing-${index}`}>Источник ${index + 1} отсутствует.</p>)}
    {node.kind === 'widget' && widget?.sources.filter(source => source.diagnostic).map(source => <p role="alert" key={source.sourceIndex}>{diagnosticMessage(source.diagnostic!.code)}</p>)}
    {node.children.length > 0 && <div className={styles.children} style={{ display: 'flex', flexDirection: direction }}>{node.children.map(child => <NodeView key={child.nodeKey} node={child} widgets={widgets} />)}</div>}
  </article>;
};

const ViewRenderer: React.FC<Props> = ({ roots, widgets }) => <div className={styles.roots}>{roots.map(node => <NodeView key={node.nodeKey} node={node} widgets={widgets} />)}</div>;
export default ViewRenderer;
