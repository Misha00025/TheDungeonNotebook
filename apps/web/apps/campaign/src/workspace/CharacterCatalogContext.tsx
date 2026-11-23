import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CampaignApiError } from './api';
import type { CatalogKind, CharacterCatalogEntryEnvelope } from './catalogTypes';
import { useResource } from './hooks';
import { useWorkspace } from './Workspace';
import type { CatalogAttributeSchemaEnvelope } from './catalogTypes';

export type CharacterCatalogProviderProps = React.PropsWithChildren<{
  campaignId: number;
  characterId: string;
  kind: CatalogKind;
  canRead: boolean;
  canWrite: boolean;
  permissionsPending?: boolean;
  onForbidden?: () => void;
}>;

export type CharacterCatalogContextValue = {
  campaignId: number;
  characterId: string;
  kind: CatalogKind;
  entries?: CharacterCatalogEntryEnvelope[];
  definitions?: CatalogAttributeSchemaEnvelope['data']['definitions'];
  entriesLoading: boolean;
  schemaLoading: boolean;
  loading: boolean;
  entriesError?: unknown;
  schemaError?: unknown;
  error?: unknown;
  canRead: boolean;
  canWrite: boolean;
  permissionsPending: boolean;
  requested: boolean;
  reload: () => void;
  upsert: (entry: CharacterCatalogEntryEnvelope) => void;
  remove: (recordId: string) => void;
  runWrite: <T>(operation: () => Promise<T>) => Promise<T>;
  reportAccessFailure: (error: unknown) => void;
};

type InternalCharacterCatalogContextValue = CharacterCatalogContextValue & { activate: () => void };
const CharacterCatalogContext = createContext<InternalCharacterCatalogContextValue | undefined>(undefined);

const statusOf = (error: unknown) => (error as { status?: number } | undefined)?.status;
const isAccessDenied = (error: unknown) => statusOf(error) === 403 || statusOf(error) === 404;

const ScopedCharacterCatalogProvider: React.FC<CharacterCatalogProviderProps & { sessionKey: string }> = ({
  campaignId,
  characterId,
  kind,
  canRead,
  canWrite,
  permissionsPending = false,
  onForbidden,
  sessionKey,
  children,
}) => {
  const { api } = useWorkspace();
  const [requested, setRequested] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, CharacterCatalogEntryEnvelope | null>>({});
  const canWriteRef = useRef(false);
  const revokedRef = useRef(false);
  const forbiddenNotifiedRef = useRef(false);
  const mountedRef = useRef(false);
  const previousPermissionsRef = useRef({ canRead, canWrite, permissionsPending });
  const onForbiddenRef = useRef(onForbidden);
  onForbiddenRef.current = onForbidden;

  const scope = `${sessionKey}:${campaignId}:${characterId}:${kind}`;
  const accessDenied = revoked;
  const readEnabled = requested && canRead && !accessDenied;
  canWriteRef.current = canWrite && canRead && !permissionsPending && !accessDenied;
  const readAccessRef = useRef(canRead && !accessDenied);
  readAccessRef.current = canRead && !accessDenied;

  const entriesResource = useResource(
    `${scope}:character-catalog-entries`,
    () => api.listCharacterEntries(campaignId, kind, characterId),
    readEnabled,
  );
  const schemaResource = useResource(
    `${sessionKey}:${campaignId}:${kind}:catalog-attribute-schema`,
    () => api.getCatalogAttributes(campaignId, kind),
    readEnabled,
  );

  const reportAccessFailure = useCallback((error: unknown) => {
    if (!mountedRef.current) return;
    const status = statusOf(error);
    if (status !== 403 && status !== 404) return;
    if (!revokedRef.current) {
      revokedRef.current = true;
      setRevoked(true);
    }
    if (status === 403 && !forbiddenNotifiedRef.current) {
      forbiddenNotifiedRef.current = true;
      onForbiddenRef.current?.();
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const previous = previousPermissionsRef.current;
    const confirmedRefresh = previous.permissionsPending && !permissionsPending
      || previous.canRead !== canRead
      || previous.canWrite !== canWrite;
    previousPermissionsRef.current = { canRead, canWrite, permissionsPending };
    if (revokedRef.current && confirmedRefresh && canRead && !permissionsPending) {
      revokedRef.current = false;
      forbiddenNotifiedRef.current = false;
      setRevoked(false);
    }
  }, [canRead, canWrite, permissionsPending]);

  useEffect(() => {
    if (isAccessDenied(entriesResource.error)) reportAccessFailure(entriesResource.error);
    else if (isAccessDenied(schemaResource.error)) reportAccessFailure(schemaResource.error);
  }, [entriesResource.error, schemaResource.error, reportAccessFailure]);

  useEffect(() => {
    if (!canRead || revoked) setOverrides({});
  }, [canRead, revoked]);

  const activate = useCallback(() => setRequested(true), []);
  const reload = useCallback(() => {
    setRequested(true);
    setOverrides({});
    if (!readEnabled) return;
    entriesResource.reload();
    schemaResource.reload();
  }, [readEnabled, entriesResource.reload, schemaResource.reload]);

  const entries = useMemo(() => {
    if (!readEnabled || isAccessDenied(entriesResource.error) || isAccessDenied(schemaResource.error)) return undefined;
    if (!entriesResource.data) return undefined;
    const merged = new Map(entriesResource.data.map(entry => [entry.record.id, entry]));
    for (const [recordId, entry] of Object.entries(overrides)) {
      if (entry === null) merged.delete(recordId);
       else if (entry.definition.kind === kind && entry.record.campaignId === campaignId && entry.record.characterId === characterId) merged.set(recordId, entry);
    }
    return [...merged.values()];
  }, [readEnabled, entriesResource.error, schemaResource.error, entriesResource.data, overrides, campaignId, characterId, kind]);

  const definitions = readEnabled && !isAccessDenied(entriesResource.error) && !isAccessDenied(schemaResource.error)
    ? schemaResource.data?.data.definitions
    : undefined;

  const upsert = useCallback((entry: CharacterCatalogEntryEnvelope) => {
    if (!mountedRef.current || !readAccessRef.current) return;
    if (entry.definition.kind !== kind || entry.record.campaignId !== campaignId || entry.record.characterId !== characterId) return;
    setOverrides(current => ({ ...current, [entry.record.id]: entry }));
  }, [campaignId, characterId, kind]);

  const remove = useCallback((recordId: string) => {
    if (!mountedRef.current || !readAccessRef.current) return;
    setOverrides(current => ({ ...current, [recordId]: null }));
  }, []);

  const runWrite = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (!mountedRef.current || !canWriteRef.current) {
      throw new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Character catalog write access is unavailable.' });
    }
    try {
      return await operation();
    } catch (error) {
      if (statusOf(error) === 403) reportAccessFailure(error);
      throw error;
    }
  }, [reportAccessFailure]);

  const deniedByResponse = isAccessDenied(entriesResource.error) || isAccessDenied(schemaResource.error);
  const effectiveCanRead = canRead && !revoked && !deniedByResponse;
  const effectiveCanWrite = canWriteRef.current && !deniedByResponse;
  const entriesLoading = readEnabled && entriesResource.loading;
  const schemaLoading = readEnabled && schemaResource.loading;
  const value = useMemo<InternalCharacterCatalogContextValue>(() => ({
    campaignId,
    characterId,
    kind,
    entries,
    definitions,
    entriesLoading,
    schemaLoading,
    loading: !requested || readEnabled && (entriesResource.loading || schemaResource.loading),
    entriesError: entriesResource.error,
    schemaError: schemaResource.error,
    error: entriesResource.error ?? schemaResource.error,
    canRead: effectiveCanRead,
    canWrite: effectiveCanWrite,
    permissionsPending,
    requested,
    reload,
    upsert,
    remove,
    runWrite,
    reportAccessFailure,
    activate,
  }), [campaignId, characterId, kind, entries, definitions, entriesLoading, schemaLoading, requested, readEnabled, entriesResource.loading, schemaResource.loading, entriesResource.error, schemaResource.error, effectiveCanRead, effectiveCanWrite, permissionsPending, reload, upsert, remove, runWrite, reportAccessFailure, activate]);

  return <CharacterCatalogContext.Provider value={value}>{children}</CharacterCatalogContext.Provider>;
};

export const CharacterCatalogProvider: React.FC<CharacterCatalogProviderProps> = props => {
  const { sessionKey } = useWorkspace();
  const scope = `${sessionKey}:${props.campaignId}:${props.characterId}:${props.kind}`;
  return <ScopedCharacterCatalogProvider key={scope} {...props} sessionKey={sessionKey} />;
};

export function useOptionalCharacterCatalog(): CharacterCatalogContextValue | undefined {
  return useContext(CharacterCatalogContext);
}

export function useCharacterCatalog(): CharacterCatalogContextValue {
  const context = useContext(CharacterCatalogContext);
  if (!context) throw new Error('useCharacterCatalog requires CharacterCatalogProvider');
  useEffect(() => {
    context.activate();
  }, [context.activate]);
  return context;
}
