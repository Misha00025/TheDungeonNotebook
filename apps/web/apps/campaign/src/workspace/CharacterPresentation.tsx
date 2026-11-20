import React, { useEffect, useMemo, useRef } from 'react';
import { Button, StatePanel } from '@tdn/shared';
import type { ComputedSheet, FieldReference, ResolvedPresentation } from './types';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { readParams, normalizeRoots, type PresentationNode } from './presentationModel';
import PresentationRenderer from './PresentationRenderer';
import { ApiError } from './Feedback';
import styles from './CharacterPresentation.module.css';

type Props = {
  campaignId: number;
  characterId: string;
  pageKey: string;
  sheet: ComputedSheet;
  conditionSheet?: ComputedSheet;
  refreshKey?: number;
  renderValue?: (reference: FieldReference, label: string, display?: React.ReactNode) => React.ReactNode;
  onVisibleFieldsChange?: (fieldIds: string[]) => void;
};

function editableBaseFields(roots: PresentationNode[], sheet: ComputedSheet): string[] {
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

const CharacterPresentation: React.FC<Props> = ({ campaignId, characterId, pageKey, sheet, conditionSheet, refreshKey = 0, renderValue, onVisibleFieldsChange }) => {
  const { api, sessionKey } = useWorkspace();
  const scope = `${sessionKey}:${campaignId}:${characterId}:${pageKey}`;
  const resolved = useResource<ResolvedPresentation>(scope, () => api.resolvePresentation(campaignId, pageKey));
  const previousRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (previousRefreshKey.current === refreshKey) return;
    previousRefreshKey.current = refreshKey;
    resolved.reload();
  }, [refreshKey, resolved.reload]);
  const status = resolved.error && typeof resolved.error === 'object' && 'status' in resolved.error ? Number(resolved.error.status) : undefined;
  const inaccessible = status === 403 || status === 404;
  const rendererAvailable = Boolean(resolved.data && !inaccessible);
  const roots = useMemo(() => rendererAvailable && resolved.data ? normalizeRoots(resolved.data.viewContent.data.roots) : [], [rendererAvailable, resolved.data]);
  const visibleFields = useMemo(() => rendererAvailable ? editableBaseFields(roots, sheet) : [], [rendererAvailable, roots, sheet]);
  useEffect(() => { onVisibleFieldsChange?.(visibleFields); }, [onVisibleFieldsChange, visibleFields]);
  useEffect(() => () => { onVisibleFieldsChange?.([]); }, [onVisibleFieldsChange]);

  return <section className={styles.section} aria-label="Страница персонажа" aria-busy={resolved.loading}>
    {resolved.loading && !resolved.data && <StatePanel kind="loading">Загрузка страницы…</StatePanel>}
    {Boolean(resolved.error) && <div className={styles.recovery}><ApiError error={resolved.error} /><Button variant="secondary" type="button" onClick={() => resolved.reload()}>Повторить загрузку страницы</Button></div>}
    {rendererAvailable && resolved.data ? <>
      {resolved.data.viewContent.data.roots.length === 0 ? <div className={styles.emptyCanvas} aria-label="Пустое отображение" /> : <PresentationRenderer roots={roots} sheet={sheet} conditionSheet={conditionSheet} renderValue={renderValue} />}
    </> : null}
  </section>;
};

export default CharacterPresentation;
