import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { CampaignApiError } from './api';
import type { Assignment, CharacterMetadata, Member, Permissions, Revision } from './types';

export type MemberOperationKind = 'role' | 'member-delete' | 'access' | 'assignment-delete' | 'member-add' | 'assignment-add';
export type MemberOperation = { kind: MemberOperationKind; busy: boolean; blocked: boolean; error?: unknown; targetValue?: boolean; userId: number; characterId?: string };
export type CharacterAccessEntry = { character: CharacterMetadata; permissions?: Permissions; assignments: Assignment[]; loading: boolean; unavailable?: boolean; error?: unknown };
export type MembersAccessState = { members: Member[]; listLoading: boolean; listError?: unknown; characters: CharacterAccessEntry[]; charsLoading: boolean; charsError?: unknown; operations: Record<string, MemberOperation>; isBusy: boolean; feedback?: { kind: 'success' | 'info'; message: string; event: number } };

export const memberOperationKey = (userId: number) => `member:${userId}`;
export const memberAddOperationKey = (userId: number) => `member-add:${userId}`;
export const assignmentOperationKey = (characterId: string, userId: number) => `assignment:${characterId}:${userId}`;
export const assignmentAddOperationKey = (characterId: string, userId: number) => `assignment-add:${characterId}:${userId}`;

const revisionValue = (revision: Revision) => BigInt(String(revision));
const newerOrEqual = (next: Revision, current: Revision) => revisionValue(next) >= revisionValue(current);
const uncertain = (error: unknown) => error instanceof CampaignApiError ? error.status === 409 || error.unknownOutcome : Boolean(error && typeof error === 'object' && ('unknownOutcome' in error && error.unknownOutcome || 'status' in error && error.status === 409));
const codeIs = (error: unknown, code: string) => Boolean(error && typeof error === 'object' && 'problem' in error && error.problem && typeof error.problem === 'object' && 'code' in error.problem && error.problem.code === code);
const forbidden = (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in error && error.status === 403);
const emptyState = (): MembersAccessState => ({ members: [], listLoading: true, characters: [], charsLoading: true, operations: {}, isBusy: false });
const memberPending = (op: MemberOperation) => op.characterId === undefined && (op.busy || op.blocked || op.targetValue !== undefined);
const assignmentPending = (op: MemberOperation, characterId: string) => op.characterId === characterId && (op.busy || op.blocked || op.targetValue !== undefined);
const removeOperation = (operations: Record<string, MemberOperation>, key: string) => Object.fromEntries(Object.entries(operations).filter(([entry]) => entry !== key));
const upsertMember = (rows: Member[], row: Member) => rows.some(item => item.userId === row.userId) ? rows.map(item => item.userId === row.userId ? row : item) : [...rows, row];
const upsertAssignment = (rows: Assignment[], row: Assignment) => rows.some(item => item.userId === row.userId) ? rows.map(item => item.userId === row.userId ? row : item) : [...rows, row];
const removeMemberRow = (rows: Member[], userId: number) => rows.filter(item => item.userId !== userId);
const removeAssignmentRow = (rows: Assignment[], userId: number) => rows.filter(item => item.userId !== userId);

const mergeMemberSnapshot = (current: Member[], incoming: Member[], operations: Record<string, MemberOperation>) => {
  const result = new Map<number, Member>();
  for (const row of incoming) {
    const old = current.find(item => item.userId === row.userId);
    result.set(row.userId, old && (Object.values(operations).some(op => op.userId === row.userId && memberPending(op)) || !newerOrEqual(row.metadataRevision, old.metadataRevision)) ? old : row);
  }
  for (const row of current) if (!result.has(row.userId) && Object.values(operations).some(op => op.userId === row.userId && memberPending(op))) result.set(row.userId, row);
  return [...result.values()];
};
const mergeAssignmentSnapshot = (current: Assignment[], incoming: Assignment[], characterId: string, operations: Record<string, MemberOperation>) => {
  const result = new Map<number, Assignment>();
  for (const row of incoming) {
    const old = current.find(item => item.userId === row.userId);
    result.set(row.userId, old && (Object.values(operations).some(op => op.userId === row.userId && assignmentPending(op, characterId)) || !newerOrEqual(row.metadataRevision, old.metadataRevision)) ? old : row);
  }
  for (const row of current) if (!result.has(row.userId) && Object.values(operations).some(op => op.userId === row.userId && assignmentPending(op, characterId))) result.set(row.userId, row);
  return [...result.values()];
};
const needsCharacterRetention = (entry: CharacterAccessEntry, operations: Record<string, MemberOperation>) => Object.values(operations).some(op => op.characterId === entry.character.id && (op.busy || op.blocked || op.targetValue !== undefined)) || entry.assignments.some(row => Object.values(operations).some(op => op.userId === row.userId && assignmentPending(op, entry.character.id)));
const mergeCharacterSnapshot = (current: CharacterAccessEntry[], incoming: CharacterMetadata[], operations: Record<string, MemberOperation>): CharacterAccessEntry[] => {
  const next: CharacterAccessEntry[] = incoming.map(character => {
    const old = current.find(item => item.character.id === character.id);
    return { character: old && !newerOrEqual(character.metadataRevision, old.character.metadataRevision) ? old.character : character, permissions: old?.permissions, assignments: old?.assignments ?? [], loading: true, unavailable: false };
  });
  for (const old of current) if (!next.some(item => item.character.id === old.character.id) && needsCharacterRetention(old, operations)) next.push({ ...old, loading: true, unavailable: true, error: new Error('Character is no longer available.') });
  return next;
};
const upsertCharacter = (rows: CharacterAccessEntry[], incoming: CharacterAccessEntry, operations: Record<string, MemberOperation>) => {
  const old = rows.find(item => item.character.id === incoming.character.id);
  const entry = { ...incoming, character: old && !newerOrEqual(incoming.character.metadataRevision, old.character.metadataRevision) ? old.character : incoming.character, assignments: mergeAssignmentSnapshot(old?.assignments ?? [], incoming.assignments, incoming.character.id, operations) };
  return old ? rows.map(item => item.character.id === entry.character.id ? entry : item) : [...rows, entry];
};

export function useMembersAccess(campaignId: number) {
  const { api, sessionKey, invalidation, notifyInvalidation } = useWorkspace();
  const { campaign, permissions, lastKnownPermissions, permissionsLoading, mode } = useCampaignWorkspace();
  const identity = `${sessionKey}:${campaignId}`;
  const displayAllowed = mode === 'gm' && lastKnownPermissions.canWrite && lastKnownPermissions.canManageAccess;
  const writable = mode === 'gm' && !permissionsLoading && permissions.canWrite && permissions.canManageAccess && campaign.id === campaignId;
  const [state, setState] = useState<MembersAccessState>(emptyState);
  const stateRef = useRef(state);
  const mounted = useRef(false);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const pendingRead = useRef(false);
  const identityRef = useRef(identity);
  const apiRef = useRef(api);
  const writableRef = useRef(writable);
  const displayRef = useRef(displayAllowed);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const feedbackEvent = useRef(0);
  stateRef.current = state;
  apiRef.current = api;
  writableRef.current = writable;
  displayRef.current = displayAllowed;

  const update = useCallback((change: (current: MembersAccessState) => MembersAccessState) => {
    if (!mounted.current) return;
    const next = change(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(async () => {
    if (!mounted.current || !displayRef.current) return;
    if (busyRef.current) { pendingRead.current = true; return; }
    busyRef.current = true;
    const gen = ++generation.current;
    const identityAtStart = identity;
    const active = () => mounted.current && displayRef.current && generation.current === gen && identityRef.current === identityAtStart;
    update(current => ({ ...current, isBusy: true, listLoading: true, charsLoading: true, listError: undefined, charsError: undefined, characters: current.characters.map(item => ({ ...item, loading: true, error: undefined })) }));
    try {
      const memberRead = apiRef.current.listMembers(campaignId).then(value => ({ value }), error => ({ error }));
      const characterRead = apiRef.current.listCharacters(campaignId).then(value => ({ value }), error => ({ error }));
      const [membersResult, charsResult] = await Promise.all([memberRead, characterRead]);
      if (!active()) return;
      if ('value' in membersResult) update(current => ({ ...current, members: mergeMemberSnapshot(current.members, membersResult.value, current.operations), listLoading: false, listError: undefined }));
      else update(current => ({ ...current, listLoading: false, listError: membersResult.error }));
      if (!('value' in charsResult)) {
        update(current => ({ ...current, charsLoading: false, charsError: charsResult.error, characters: current.characters.map(item => ({ ...item, loading: false })) }));
        return;
      }
      update(current => ({ ...current, characters: mergeCharacterSnapshot(current.characters, charsResult.value, current.operations), charsLoading: false, charsError: undefined }));
      const characterIds = charsResult.value.map(item => item.id);
      const oldCharacters = stateRef.current.characters;
      await Promise.all(charsResult.value.map(async character => {
        const old = oldCharacters.find(item => item.character.id === character.id);
        try {
          const rights = await apiRef.current.characterPermissions(campaignId, character.id);
          if (!active()) return;
          if (!rights.canManageAccess) {
            update(current => ({ ...current, characters: upsertCharacter(current.characters, { character, permissions: rights, assignments: old?.assignments ?? [], loading: false, error: { kind: 'denied' } }, current.operations) }));
            return;
          }
          if (!active()) return;
          const assignments = await apiRef.current.listAssignments(campaignId, character.id);
          if (!active()) return;
          update(current => ({ ...current, characters: upsertCharacter(current.characters, { character, permissions: rights, assignments, loading: false }, current.operations) }));
        } catch (error) {
          if (!active()) return;
          update(current => ({ ...current, characters: upsertCharacter(current.characters, { character, permissions: old?.permissions, assignments: old?.assignments ?? [], loading: false, error }, current.operations) }));
        }
      }));
      if (active()) update(current => ({ ...current, characters: current.characters.map(item => characterIds.includes(item.character.id) || !needsCharacterRetention(item, current.operations) ? item : { ...item, loading: false, unavailable: true, error: new Error('Character is no longer available.') }) }));
    } catch (error) {
      if (active()) update(current => ({ ...current, listLoading: false, listError: current.listError ?? error, charsLoading: false, charsError: current.charsError ?? error }));
    } finally {
      if (identityRef.current === identityAtStart && generation.current === gen) {
        busyRef.current = false;
        if (mounted.current) update(current => ({ ...current, isBusy: false }));
        if (pendingRead.current) { pendingRead.current = false; if (displayRef.current) void loadRef.current(); }
      }
    }
  }, [campaignId, identity, update]);
  loadRef.current = load;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; busyRef.current = false; pendingRead.current = false; };
  }, []);
  useEffect(() => {
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      generation.current += 1;
      busyRef.current = false;
      pendingRead.current = false;
      stateRef.current = emptyState();
      setState(emptyState());
    }
    void load();
  }, [identity, displayAllowed, load]);
  const previousInvalidation = useRef(invalidation);
  useEffect(() => {
    if (previousInvalidation.current === invalidation) return;
    previousInvalidation.current = invalidation;
    void load();
  }, [invalidation, load]);

  const memberDirty = state.members.some(row => { const op = state.operations[memberOperationKey(row.userId)]; return Boolean(op?.targetValue !== undefined && op.targetValue !== row.isAdmin); }) || Object.values(state.operations).some(op => op.characterId === undefined && (op.blocked || op.busy));
  const assignmentDirty = state.characters.some(entry => entry.assignments.some(row => { const op = state.operations[assignmentOperationKey(entry.character.id, row.userId)]; return Boolean(op?.targetValue !== undefined && op.targetValue !== row.canWrite); })) || Object.values(state.operations).some(op => op.characterId !== undefined && (op.blocked || op.busy));
  useDirtyDraft(`members-access-${identity}`, memberDirty || assignmentDirty);

  const mutate = useCallback(async <T,>(key: string, op: MemberOperation, action: () => Promise<T>, apply: (current: MembersAccessState, result: T) => MembersAccessState, permitted: () => boolean = () => true): Promise<boolean> => {
    if (busyRef.current || !writableRef.current || !mounted.current) return false;
    const before = stateRef.current.operations[key];
    if (before?.blocked) return false;
    busyRef.current = true;
    const gen = generation.current;
    const identityAtStart = identity;
    const active = () => mounted.current && generation.current === gen && identityRef.current === identityAtStart;
    update(current => ({ ...current, isBusy: true, operations: { ...current.operations, [key]: { ...op, busy: true, error: undefined } } }));
    let confirmed = false;
    try {
      if (!active() || !writableRef.current || !permitted()) return false;
      const result = await action();
      if (!active()) return false;
      update(current => {
        const applied = apply(current, result);
        return { ...applied, isBusy: false, operations: removeOperation(applied.operations, key), feedback: { kind: 'success', message: successMessage(op.kind), event: ++feedbackEvent.current } };
      });
      confirmed = true;
      notifyInvalidation('access');
      return true;
    } catch (error) {
      if (!active()) return false;
      const blocked = (uncertain(error) && !codeIs(error, 'member_has_assignments')) || codeIs(error, 'member_already_exists') || codeIs(error, 'assignment_already_exists');
      update(current => ({ ...current, isBusy: false, operations: { ...current.operations, [key]: { ...op, busy: false, blocked, error } } }));
      if (forbidden(error)) notifyInvalidation('access');
      return false;
    } finally {
      if (identityRef.current === identityAtStart && generation.current === gen) {
        busyRef.current = false;
        if (mounted.current) update(current => ({ ...current, isBusy: false, operations: confirmed ? current.operations : Object.fromEntries(Object.entries(current.operations).map(([entry, value]) => [entry, entry === key ? { ...value, busy: false } : value])) }));
        if (pendingRead.current) { pendingRead.current = false; if (displayRef.current) void load(); }
      }
    }
  }, [identity, load, notifyInvalidation, update]);

  const setMemberRole = useCallback((userId: number, isAdmin: boolean) => {
    const row = stateRef.current.members.find(item => item.userId === userId);
    if (!row) return Promise.resolve(false);
    return mutate(memberOperationKey(userId), { kind: 'role', busy: false, blocked: false, targetValue: isAdmin, userId }, () => apiRef.current.putMember(campaignId, userId, { isAdmin, expectedRevision: row.metadataRevision }), (current, result) => ({ ...current, members: upsertMember(current.members, result) }));
  }, [campaignId, mutate]);
  const removeMember = useCallback((userId: number) => {
    const row = stateRef.current.members.find(item => item.userId === userId);
    if (!row) return Promise.resolve(false);
    return mutate(memberOperationKey(userId), { kind: 'member-delete', busy: false, blocked: false, userId }, async () => { await apiRef.current.deleteMember(campaignId, userId, row.metadataRevision); }, current => ({ ...current, members: removeMemberRow(current.members, userId) }));
  }, [campaignId, mutate]);
  const setAssignmentAccess = useCallback((characterId: string, userId: number, canWrite: boolean) => {
    const entry = stateRef.current.characters.find(item => item.character.id === characterId);
    const row = entry?.assignments.find(item => item.userId === userId);
    const permitted = () => Boolean(writableRef.current && !stateRef.current.charsError && stateRef.current.characters.find(item => item.character.id === characterId)?.permissions?.canManageAccess && !stateRef.current.characters.find(item => item.character.id === characterId)?.loading && !stateRef.current.characters.find(item => item.character.id === characterId)?.unavailable && !stateRef.current.characters.find(item => item.character.id === characterId)?.error);
    if (!row || !permitted()) return Promise.resolve(false);
    return mutate(assignmentOperationKey(characterId, userId), { kind: 'access', busy: false, blocked: false, targetValue: canWrite, userId, characterId }, () => apiRef.current.putAssignment(campaignId, characterId, userId, { canWrite, expectedRevision: row.metadataRevision }), (current, result) => ({ ...current, characters: current.characters.map(item => item.character.id === characterId ? { ...item, assignments: upsertAssignment(item.assignments, result) } : item) }), permitted);
  }, [campaignId, mutate]);
  const removeAssignment = useCallback((characterId: string, userId: number) => {
    const entry = stateRef.current.characters.find(item => item.character.id === characterId);
    const row = entry?.assignments.find(item => item.userId === userId);
    const permitted = () => Boolean(writableRef.current && !stateRef.current.charsError && stateRef.current.characters.find(item => item.character.id === characterId)?.permissions?.canManageAccess && !stateRef.current.characters.find(item => item.character.id === characterId)?.loading && !stateRef.current.characters.find(item => item.character.id === characterId)?.unavailable && !stateRef.current.characters.find(item => item.character.id === characterId)?.error);
    if (!row || !permitted()) return Promise.resolve(false);
    return mutate(assignmentOperationKey(characterId, userId), { kind: 'assignment-delete', busy: false, blocked: false, userId, characterId }, async () => { await apiRef.current.deleteAssignment(campaignId, characterId, userId, row.metadataRevision); }, current => ({ ...current, characters: current.characters.map(item => item.character.id === characterId ? { ...item, assignments: removeAssignmentRow(item.assignments, userId) } : item) }), permitted);
  }, [campaignId, mutate]);

  const addMember = useCallback((userId: number) => {
    const key = memberAddOperationKey(userId);
    const existing = stateRef.current.operations[key];
    if (stateRef.current.members.some(item => item.userId === userId) || Object.values(stateRef.current.operations).some(op => op.kind === 'member-add' && op.userId !== userId) || existing?.blocked || existing?.busy) return Promise.resolve(false);
    return mutate(key, existing ?? { kind: 'member-add', busy: false, blocked: false, userId, targetValue: false }, () => apiRef.current.putMember(campaignId, userId, { isAdmin: false, expectedRevision: 0 }), (current, result) => ({ ...current, members: upsertMember(current.members, result) }));
  }, [campaignId, mutate]);
  const addAssignment = useCallback((characterId: string, userId: number, canWrite = false) => {
    const key = assignmentAddOperationKey(characterId, userId);
    const entry = stateRef.current.characters.find(item => item.character.id === characterId);
    const existing = stateRef.current.operations[key];
    const permitted = () => Boolean(writableRef.current && !stateRef.current.charsError && stateRef.current.members.some(item => item.userId === userId) && stateRef.current.characters.find(item => item.character.id === characterId)?.permissions?.canManageAccess && !stateRef.current.characters.find(item => item.character.id === characterId)?.loading && !stateRef.current.characters.find(item => item.character.id === characterId)?.unavailable && !stateRef.current.characters.find(item => item.character.id === characterId)?.error);
    if (!entry || entry.assignments.some(item => item.userId === userId) || Object.values(stateRef.current.operations).some(op => op.kind === 'assignment-add' && (op.userId !== userId || op.characterId !== characterId)) || existing?.blocked || existing?.busy || !permitted()) return Promise.resolve(false);
    return mutate(key, existing ?? { kind: 'assignment-add', busy: false, blocked: false, userId, characterId, targetValue: canWrite }, () => apiRef.current.putAssignment(campaignId, characterId, userId, { canWrite: existing?.targetValue ?? canWrite, expectedRevision: 0 }), (current, result) => ({ ...current, characters: current.characters.map(item => item.character.id === characterId ? { ...item, assignments: upsertAssignment(item.assignments, result) } : item) }), permitted);
  }, [campaignId, mutate]);

  const beginRead = useCallback((keys: string[]) => {
    if (busyRef.current || !mounted.current) return false;
    busyRef.current = true;
    update(current => ({ ...current, isBusy: true, operations: Object.fromEntries(Object.entries(current.operations).map(([key, op]) => [key, keys.includes(key) ? { ...op, busy: true, error: undefined } : op])) }));
    return true;
  }, [update]);
  const endRead = useCallback(() => {
    busyRef.current = false;
    if (mounted.current) update(current => ({ ...current, isBusy: false, operations: Object.fromEntries(Object.entries(current.operations).map(([key, op]) => [key, op.busy ? { ...op, busy: false } : op])) }));
    if (pendingRead.current) { pendingRead.current = false; if (displayRef.current) void loadRef.current(); }
  }, [update]);

  const rereadMember = useCallback(async (userId: number) => {
    const key = memberOperationKey(userId);
    const addKey = memberAddOperationKey(userId);
    if (!displayRef.current || !writableRef.current || !beginRead([key, addKey])) return false;
    const gen = generation.current;
    const identityAtStart = identity;
    const active = () => mounted.current && displayRef.current && writableRef.current && generation.current === gen && identityRef.current === identityAtStart;
    try {
      const list = await apiRef.current.listMembers(campaignId);
      if (!active()) return false;
      const row = list.find(item => item.userId === userId);
      update(current => {
        const operations = removeOperation(removeOperation(current.operations, addKey), key);
        if (!row) return { ...current, members: removeMemberRow(current.members, userId), operations, feedback: { kind: 'info', message: 'Запись отсутствует. Повторная запись не отправлена.', event: ++feedbackEvent.current } };
        const prev = current.operations[key];
        const nextOperations = prev?.targetValue !== undefined && prev.targetValue !== row.isAdmin ? { ...operations, [key]: { ...prev, busy: false, blocked: false, error: undefined } } : operations;
        return { ...current, members: upsertMember(current.members, row), operations: nextOperations, feedback: current.operations[addKey] ? { kind: 'info', message: 'Запись уже существует. Повторное добавление не отправлено.', event: ++feedbackEvent.current } : current.feedback };
      });
      return true;
    } catch (error) {
      if (active()) {
        update(current => ({ ...current, operations: updateReadError(current.operations, key, addKey, error) }));
        if (forbidden(error)) notifyInvalidation('access');
      }
      return false;
    } finally { if (identityRef.current === identityAtStart && generation.current === gen) endRead(); }
  }, [beginRead, campaignId, endRead, identity, notifyInvalidation, update]);

  const rereadAssignment = useCallback(async (characterId: string, userId: number) => {
    const key = assignmentOperationKey(characterId, userId);
    const addKey = assignmentAddOperationKey(characterId, userId);
    const delKey = key;
    if (!displayRef.current || !writableRef.current || !beginRead([key, addKey])) return false;
    const gen = generation.current;
    const identityAtStart = identity;
    const active = () => mounted.current && displayRef.current && writableRef.current && generation.current === gen && identityRef.current === identityAtStart;
    try {
      const rights = await apiRef.current.characterPermissions(campaignId, characterId);
      if (!active()) return false;
      if (!rights.canManageAccess) throw new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Access management is no longer permitted.' });
      if (!displayRef.current || !writableRef.current) return false;
      const rows = await apiRef.current.listAssignments(campaignId, characterId);
      if (!active()) return false;
      const row = rows.find(item => item.userId === userId);
      update(current => ({
        ...current,
        characters: current.characters.map(entry => entry.character.id === characterId ? { ...entry, permissions: rights, loading: false, unavailable: false, error: undefined, assignments: row ? upsertAssignment(entry.assignments, row) : removeAssignmentRow(entry.assignments, userId) } : entry),
        operations: row ? (() => {
          const prev = current.operations[delKey];
          const withoutAdd = removeOperation(current.operations, addKey);
          if (current.operations[addKey]) return removeOperation(withoutAdd, delKey);
          if (!prev) return withoutAdd;
          const matches = prev.targetValue === undefined || prev.targetValue === row.canWrite;
          return matches ? removeOperation(withoutAdd, delKey) : { ...withoutAdd, [delKey]: { ...prev, busy: false, blocked: false, error: undefined } };
        })() : removeOperation(removeOperation(current.operations, delKey), addKey),
        ...(!row ? { feedback: { kind: 'info' as const, message: 'Запись отсутствует. Повторная запись не отправлена.', event: ++feedbackEvent.current } } : current.operations[addKey] ? { feedback: { kind: 'info' as const, message: 'Запись уже существует. Повторное добавление не отправлено.', event: ++feedbackEvent.current } } : {}),
      }));
      return true;
    } catch (error) {
      if (active()) {
        update(current => ({ ...current, characters: current.characters.map(entry => entry.character.id === characterId ? { ...entry, loading: false, error } : entry), operations: updateReadError(current.operations, delKey, addKey, error) }));
        if (forbidden(error)) notifyInvalidation('access');
      }
      return false;
    } finally { if (identityRef.current === identityAtStart && generation.current === gen) endRead(); }
  }, [beginRead, campaignId, endRead, identity, notifyInvalidation, update]);

  const retryOperation = useCallback((key: string) => {
    const op = stateRef.current.operations[key];
    if (!op || op.blocked) return Promise.resolve(false);
    if (op.kind === 'role' && op.targetValue !== undefined) return setMemberRole(op.userId, op.targetValue);
    if (op.kind === 'access' && op.targetValue !== undefined && op.characterId) return setAssignmentAccess(op.characterId, op.userId, op.targetValue);
    if (op.kind === 'member-add') return addMember(op.userId);
    if (op.kind === 'assignment-add' && op.characterId) return addAssignment(op.characterId, op.userId, op.targetValue ?? false);
    return Promise.resolve(false);
  }, [addAssignment, addMember, setAssignmentAccess, setMemberRole]);
  const discardOperation = useCallback((key: string) => update(current => busyRef.current || current.operations[key]?.busy || current.operations[key]?.blocked ? current : { ...current, operations: removeOperation(current.operations, key) }), [update]);
  const reload = useCallback(() => load(), [load]);
  const operationForMember = useCallback((userId: number) => state.operations[memberOperationKey(userId)], [state.operations]);
  const operationForAssignment = useCallback((characterId: string, userId: number) => state.operations[assignmentOperationKey(characterId, userId)], [state.operations]);
  return { ...state, displayAllowed, writable, memberDirty, assignmentDirty, reload, setMemberRole, removeMember, addMember, setAssignmentAccess, removeAssignment, addAssignment, operationForMember, operationForAssignment, rereadMember, rereadAssignment, retryOperation, discardOperation, memberOperationKey, memberAddOperationKey, assignmentOperationKey, assignmentAddOperationKey, pendingMemberAdds: Object.entries(state.operations).filter(([, op]) => op.kind === 'member-add'), pendingAssignmentAdds: Object.entries(state.operations).filter(([, op]) => op.kind === 'assignment-add') };
}

const updateReadError = (operations: Record<string, MemberOperation>, primaryKey: string, addKey: string, error: unknown) => {
  const key = operations[primaryKey] ? primaryKey : operations[addKey] ? addKey : undefined;
  if (!key) return operations;
  return { ...operations, [key]: { ...operations[key], busy: false, error } };
};
const successMessage = (kind: MemberOperationKind) => ({ role: 'Роль участника изменена.', 'member-delete': 'Членство удалено.', access: 'Доступ к персонажу изменён.', 'assignment-delete': 'Доступ к персонажу снят.', 'member-add': 'Участник добавлен.', 'assignment-add': 'Назначение добавлено.' })[kind];
