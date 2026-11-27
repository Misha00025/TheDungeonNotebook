import React, { useEffect, useMemo, useRef } from 'react';
import { Button, StatePanel } from '@tdn/shared';
import type { ComputedSheet, FieldReference, ResolvedPresentation } from './types';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { readParams, normalizeRoots, type PresentationNode, type PresentationSurface } from './presentationModel';
import PresentationRenderer from './PresentationRenderer';
import { ApiError } from './Feedback';
import styles from './CharacterPresentation.module.css';

type Props = {
  campaignId: number;
  characterId: string;
  pageKey: string;
  resolvedPresentation?: ResolvedPresentation;
  onRetryResolved?: () => void;
  surface?: PresentationSurface;
  sheet: ComputedSheet;
  conditionSheet?: ComputedSheet;
  refreshKey?: number;
  renderValue?: (reference: FieldReference, label: string, display?: React.ReactNode) => React.ReactNode;
  onVisibleFieldsChange?: (fieldIds: string[]) => void;
};

export function editableBaseFields(roots: PresentationNode[], sheet: ComputedSheet): string[] {
  const ids = new Set<string>();
  const known = new Set(sheet.baseFields.map(field => field.id));
  const visit = (nodes: PresentationNode[]) => nodes.forEach(node => {
    const result = readParams(node.params);
    if (result.status === 'supported') {
      if (result.type === 'composite') {
        const primary = result.params.primary;
        if (primary?.kind === 'Base' && result.params.parts.some(part => 'source' in part && part.source.kind === 'Base' && part.source.fieldId === primary.fieldId) && known.has(primary.fieldId)) ids.add(primary.fieldId);
      }
      if (result.type === 'resource') [result.params.current, result.params.maximum].forEach(reference => { if (reference?.kind === 'Base' && known.has(reference.fieldId)) ids.add(reference.fieldId); });
      if (result.type === 'stat-list') result.params.entries.forEach(entry => { if (entry.source.kind === 'Base' && known.has(entry.source.fieldId)) ids.add(entry.source.fieldId); });
    }
    visit(node.children);
  });
  visit(roots);
  return [...ids];
}

const CharacterPresentation: React.FC<Props> = ({ campaignId, characterId, pageKey, surface = 'page', sheet, conditionSheet, refreshKey = 0, resolvedPresentation, onRetryResolved, renderValue, onVisibleFieldsChange }) => {
  const { api, sessionKey } = useWorkspace();
  const scope = `${sessionKey}:${campaignId}:${characterId}:${pageKey}`;
  const resolved = useResource<ResolvedPresentation>(scope, () => api.resolvePresentation(campaignId, pageKey), !resolvedPresentation);
  const previousRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (previousRefreshKey.current === refreshKey) return;
    previousRefreshKey.current = refreshKey;
    resolved.reload();
  }, [refreshKey, resolved.reload]);
  const status = resolved.error && typeof resolved.error === 'object' && 'status' in resolved.error ? Number(resolved.error.status) : undefined;
  const inaccessible = status === 403 || status === 404;
  const resolvedData = resolvedPresentation ?? resolved.data;
  const resolvedError = resolvedPresentation ? undefined : resolved.error;
  const resolvedLoading = resolvedPresentation ? false : resolved.loading;
  const rendererAvailable = Boolean(resolvedData && !inaccessible);
  const roots = useMemo(() => rendererAvailable && resolvedData ? normalizeRoots(resolvedData.viewContent.data.roots) : [], [rendererAvailable, resolvedData]);
  const visibleFields = useMemo(() => rendererAvailable ? editableBaseFields(roots, sheet) : [], [rendererAvailable, roots, sheet]);
  useEffect(() => { onVisibleFieldsChange?.(visibleFields); }, [onVisibleFieldsChange, visibleFields]);
  useEffect(() => () => { onVisibleFieldsChange?.([]); }, [onVisibleFieldsChange]);

  const surfaceLabel = surface === 'header' ? 'Шапка персонажа' : surface === 'card' ? 'Карточка персонажа' : 'Страница персонажа';
  return <section className={styles.section} aria-label={surfaceLabel} aria-busy={resolvedLoading}>
    {resolvedLoading && !resolvedData && <StatePanel kind="loading">Загрузка: {surfaceLabel.toLocaleLowerCase()}…</StatePanel>}
    {Boolean(resolvedError) && <div className={styles.recovery}><ApiError error={resolvedError} /><Button variant="secondary" type="button" onClick={() => onRetryResolved ? onRetryResolved() : resolved.reload()}>Повторить загрузку</Button></div>}
    {rendererAvailable && resolvedData ? <>
      {resolvedData.viewContent.data.roots.length === 0 ? <div className={styles.emptyCanvas} aria-label={`Пустое отображение: ${surfaceLabel}`} /> : <PresentationRenderer roots={roots} sheet={sheet} conditionSheet={conditionSheet} surface={surface} renderValue={renderValue} />}
    </> : null}
  </section>;
};

export default CharacterPresentation;
