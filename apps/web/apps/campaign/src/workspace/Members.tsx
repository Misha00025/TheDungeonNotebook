import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft, useDirtyState } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation, useResource } from './hooks';
import type { Assignment, CharacterMetadata, Member, Permissions, User } from './types';
import { ApiError } from './Feedback';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

const isStatus = (error: unknown, status: number) => Boolean(error && typeof error === 'object' && 'status' in error && Number(error.status) === status);
const isCode = (error: unknown, code: string) => Boolean(error && typeof error === 'object' && 'problem' in error && (error as { problem?: { code?: string } }).problem?.code === code);
const unknownOutcome = (error: unknown) => Boolean(error && typeof error === 'object' && 'unknownOutcome' in error && error.unknownOutcome);
const int32 = (value: string) => /^-?\d+$/.test(value) && Number.isInteger(Number(value)) && Number(value) >= -2147483648 && Number(value) <= 2147483647;

const MemberOption: React.FC<{ campaignId: number; sessionKey: string; member: Member }> = ({ campaignId, sessionKey, member }) => {
  const { api } = useWorkspace();
  const profile = useResource<User>(`${sessionKey}:${campaignId}:user:${member.userId}`, () => api.getUser(member.userId));
  const visibleName = profile.data?.visibleName || profile.data?.nickname;
  return <option value={member.userId}>{profile.loading ? 'Загрузка профиля…' : profile.error || !visibleName ? 'Профиль недоступен' : `${visibleName}${profile.data?.nickname ? ` (@${profile.data.nickname})` : ''}`}</option>;
};

const MemberRow: React.FC<{ campaignId: number; sessionKey: string; row: Member; writeAllowed: boolean; onChanged: () => void }> = ({ campaignId, sessionKey, row, writeAllowed, onChanged }) => {
  const { api } = useWorkspace();
  const profile = useResource<User>(`${sessionKey}:${campaignId}:user:${row.userId}`, () => api.getUser(row.userId));
  const [baseline, setBaseline] = useState({ value: row.isAdmin, revision: row.metadataRevision });
  const [admin, setAdmin] = useState(row.isAdmin);
  const [frozen, setFrozen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [readError, setReadError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [snapshot, setSnapshot] = useState<Member>();
  const dirty = admin !== baseline.value;
  const clearDirty = useDirtyDraft(`member-${campaignId}-${row.userId}`, dirty);
  const pending = useRef(false);
  const seenRevision = useRef(String(row.metadataRevision));
  const ownSuccessRevision = useRef<string | undefined>(undefined);
  useEffect(() => {
    const nextRevision = String(row.metadataRevision);
    if (seenRevision.current === nextRevision) return;
    seenRevision.current = nextRevision;
    if (ownSuccessRevision.current === nextRevision) { ownSuccessRevision.current = undefined; return; }
    if (!dirty) { setBaseline({ value: row.isAdmin, revision: row.metadataRevision }); setAdmin(row.isAdmin); setSnapshot(undefined); setFrozen(false); setSaved(false); }
    else if (nextRevision !== String(baseline.revision)) { setSnapshot(row); setFrozen(true); }
  }, [row, dirty, baseline.revision]);
  const save = useMutation((value: boolean) => api.putMember(campaignId, row.userId, { isAdmin: value, expectedRevision: baseline.revision }));
  const remove = useMutation(() => api.deleteMember(campaignId, row.userId, baseline.revision));
  const reread = async () => { setReadError(undefined); try { const fresh = await api.listMembers(campaignId); const current = fresh.find(item => item.userId === row.userId); if (!current) { setMissing(true); setFrozen(true); setSnapshot(undefined); return; } setMissing(false); setBaseline({ value: current.isAdmin, revision: current.metadataRevision }); setSnapshot(current); setFrozen(false); } catch (error) { setReadError(error); setFrozen(true); if (isStatus(error, 403)) onChanged(); } };
  const cancel = () => { if (dirty && !window.confirm('Отказаться от черновика участника?')) return; setAdmin(baseline.value); clearDirty(); };
  const saveRow = async () => { if (!writeAllowed || frozen || missing || pending.current || save.busy || remove.busy) return; pending.current = true; const submitted = admin; try { const result = await save.run(submitted); if (result) { setBaseline({ value: result.isAdmin, revision: result.metadataRevision }); setAdmin(result.isAdmin); ownSuccessRevision.current = String(result.metadataRevision); setSnapshot(undefined); setFrozen(false); setMissing(false); setSaved(true); clearDirty(); onChanged(); } } catch (error) { if ((isStatus(error, 409) && !rowConflict(error)) || Boolean(error && typeof error === 'object' && 'unknownOutcome' in error && error.unknownOutcome)) setFrozen(true); if (isStatus(error, 403)) onChanged(); } finally { pending.current = false; } };
  const deleteRow = async () => { if (!writeAllowed || frozen || missing || pending.current || save.busy || remove.busy) return; if (!window.confirm('Удалить членство в кампании? Доступы к персонажам автоматически не удаляются.')) return; pending.current = true; try { await remove.run(); onChanged(); } catch (error) { if ((isStatus(error, 409) && !rowConflict(error)) || Boolean(error && typeof error === 'object' && 'unknownOutcome' in error && error.unknownOutcome)) setFrozen(true); if (isStatus(error, 403)) onChanged(); } finally { pending.current = false; } };
  return <article className={commonStyles.card}>
     <h3>{profile.data?.visibleName || profile.data?.nickname || 'Профиль недоступен'}</h3>
      {profile.loading && <p>Загрузка профиля…</p>}{Boolean(profile.error) && <ApiError error={profile.error} />}
      <label><input type="checkbox" checked={admin} disabled={!writeAllowed || save.busy || remove.busy || frozen || missing} onChange={event => { setAdmin(event.target.checked); setSaved(false); }} /> Администратор кампании</label>
      {saved && <p role="status">Изменения сохранены.</p>}
      {snapshot && <p>Актуальная версия: {snapshot.isAdmin ? 'администратор' : 'участник'}. Черновик сохранён отдельно.</p>}{missing && <p role="alert">Запись отсутствует на сервере. Черновик оставлен только для чтения.</p>}
    {rowConflict(remove.error) && <p role="alert">Нельзя удалить членство: к участнику привязаны назначения. Удалите их отдельно в доступе к персонажу; каскад не выполняется.</p>}
     {Boolean(save.error) && <ApiError error={save.error} />}{Boolean(remove.error && !rowConflict(remove.error)) && <ApiError error={remove.error} />}{Boolean(readError) && <ApiError error={readError} />}
     {frozen && <div role="alert"><p>Изменение не подтверждено. Перечитайте запись и сравните версии до дальнейших действий.</p><button type="button" className={buttonStyles.button} onClick={() => void reread()}>Перечитать запись</button>{missing && <button type="button" className={buttonStyles.button} onClick={() => { setMissing(false); setFrozen(false); setAdmin(baseline.value); clearDirty(); onChanged(); }}>Подтвердить отсутствие записи</button>}</div>}
    <div className={commonStyles.formActions}>
       <button className={buttonStyles.button} disabled={!writeAllowed || !dirty || save.busy || remove.busy || frozen || missing} onClick={() => void saveRow()}>Сохранить</button>
        <button className={buttonStyles.button} disabled={save.busy || remove.busy || pending.current || missing} onClick={cancel}>Отмена</button>
        <button className={buttonStyles.button} disabled={!writeAllowed || save.busy || remove.busy || frozen || missing} onClick={() => void deleteRow()}>Удалить членство</button>
      {(isStatus(save.error, 409) || isStatus(remove.error, 409)) && !frozen && <button type="button" className={buttonStyles.button} onClick={() => void reread()}>Перечитать запись</button>}
    </div>
  </article>;
};

const rowConflict = (error: unknown) => Boolean(error && typeof error === 'object' && 'problem' in error && (error as { problem?: { code?: string } }).problem?.code === 'member_has_assignments');

const Members: React.FC = () => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, sessionKey, invalidation, notifyInvalidation } = useWorkspace();
  const { permissions, lastKnownPermissions, permissionsLoading = false, mode } = useCampaignWorkspace();
  const dirtyAnywhere = useDirtyState();
  const allowed = mode === 'gm' && permissions.canWrite;
  const memberDisplayScope = mode === 'gm' && lastKnownPermissions.canWrite && lastKnownPermissions.canManageAccess;
  const memberScope = allowed && permissions.canManageAccess && !permissionsLoading;
  const members = useResource<Member[]>(`${sessionKey}:${campaignId}:members`, () => api.listMembers(campaignId), memberDisplayScope);
  const characters = useResource<CharacterMetadata[]>(`${sessionKey}:${campaignId}:assignment-characters`, () => api.listCharacters(campaignId), mode === 'gm' && lastKnownPermissions.canWrite);
  const [characterId, setCharacterId] = useState('');
  const characterPermission = useResource<Permissions>(`${sessionKey}:${campaignId}:character-access:${characterId}`, () => api.characterPermissions(campaignId, characterId), Boolean(characterId && mode === 'gm' && lastKnownPermissions.canWrite));
  const assignmentReady = Boolean(characterId && allowed && !permissionsLoading && !characterPermission.loading && !characterPermission.error && characterPermission.data?.canManageAccess);
  const assignmentDisplayReady = Boolean(characterId && mode === 'gm' && lastKnownPermissions.canWrite && characterPermission.data?.canManageAccess);
  const assignments = useResource<Assignment[]>(`${sessionKey}:${campaignId}:assignments:${characterId}`, () => api.listAssignments(campaignId, characterId), assignmentDisplayReady);
  const [nickname, setNickname] = useState('');
  const [searchResults, setSearchResults] = useState<User[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGrantUserId, setSelectedGrantUserId] = useState('');
  const [searchError, setSearchError] = useState<unknown>();
  const [addError, setAddError] = useState<unknown>();
  const [memberAddBlock, setMemberAddBlock] = useState<{ userId: number; isAdmin: false; exists?: boolean; error?: unknown }>();
  const [assignmentAddBlock, setAssignmentAddBlock] = useState<{ userId: number; characterId: string; canWrite: false; exists?: boolean; error?: unknown }>();
  const searchSequence = useRef(0);
  const addMember = useMutation((userId: number) => api.putMember(campaignId, userId, { isAdmin: false, expectedRevision: 0 }));
  const addAssignment = useMutation((userId: number) => api.putAssignment(campaignId, characterId, userId, { canWrite: false, expectedRevision: 0 }));
  const previousInvalidation = useRef(invalidation);
  useEffect(() => { if (previousInvalidation.current === invalidation) return; previousInvalidation.current = invalidation; members.reload(); characters.reload(); characterPermission.reload(); assignments.reload(); }, [invalidation]);
  useEffect(() => () => { searchSequence.current += 1; }, []);
  const refresh = () => notifyInvalidation('access');
  const search = async (event: React.FormEvent) => {
    event.preventDefault(); if (!memberScope) return; const sequence = ++searchSequence.current; setSearchError(undefined); setSearchResults(null);
    try { const found = await api.searchUsers(nickname); if (sequence === searchSequence.current) setSearchResults(found); }
    catch (error) { if (sequence === searchSequence.current) setSearchError(error); }
  };
  const add = async (event: React.FormEvent) => { event.preventDefault(); if (!memberScope || !int32(selectedUserId) || addMember.busy || memberAddBlock) return; const userId = Number(selectedUserId); setAddError(undefined); try { await addMember.run(userId); setSelectedUserId(''); setSearchResults(null); refresh(); } catch (error) { setAddError(error); if (unknownOutcome(error) || isCode(error, 'member_already_exists')) setMemberAddBlock({ userId, isAdmin: false }); if (isStatus(error, 403)) refresh(); } };
  const verifyMemberAdd = async () => { if (!memberScope || !memberAddBlock) return; try { const current = (await api.listMembers(campaignId)).find(item => item.userId === memberAddBlock.userId); if (current) { setMemberAddBlock({ userId: current.userId, isAdmin: memberAddBlock.isAdmin, exists: true }); refresh(); } else setMemberAddBlock(undefined); } catch (error) { setMemberAddBlock(current => current ? { ...current, error } : current); } };
  const selectCharacter = (next: string) => { if (next === characterId) return; if ((dirtyAnywhere || assignmentAddBlock) && !window.confirm(assignmentAddBlock ? 'Результат добавления назначения не подтверждён. Сменить персонажа и оставить проверку для текущего персонажа?' : 'Есть несохранённые изменения. Сменить выбранного персонажа?')) return; setCharacterId(next); setSelectedGrantUserId(''); setAssignmentAddBlock(undefined); };
  const addGrant = async (event: React.FormEvent) => { event.preventDefault(); if (!assignmentReady || !memberScope || !int32(selectedGrantUserId) || addAssignment.busy || assignmentAddBlock) return; const userId = Number(selectedGrantUserId); setAddError(undefined); try { await addAssignment.run(userId); setSelectedGrantUserId(''); refresh(); } catch (error) { setAddError(error); if (unknownOutcome(error) || isCode(error, 'assignment_already_exists')) setAssignmentAddBlock({ userId, characterId, canWrite: false }); if (isStatus(error, 403)) refresh(); } };
  const verifyAssignmentAdd = async () => { if (!assignmentReady || !assignmentAddBlock || assignmentAddBlock.characterId !== characterId) return; try { const current = (await api.listAssignments(campaignId, characterId)).find(item => item.userId === assignmentAddBlock.userId); if (current) { setAssignmentAddBlock({ ...assignmentAddBlock, exists: true }); refresh(); } else setAssignmentAddBlock(undefined); } catch (error) { setAssignmentAddBlock(current => current ? { ...current, error } : current); } };
  return <section className={styles.page}>
      <h2>Участники кампании</h2>
      {!allowed && <p role="alert">Нет доступа к управлению участниками.</p>}
      {memberDisplayScope ? <>
        {members.loading && !members.data && <p>Загрузка участников…</p>}{Boolean(members.error) && <ApiError error={members.error} onRetry={members.reload} />}
        {members.data?.map(member => <MemberRow key={`${sessionKey}:${campaignId}:${member.userId}`} campaignId={campaignId} sessionKey={sessionKey} row={member} writeAllowed={memberScope} onChanged={refresh} />)}
        {members.data?.length === 0 && <p>Участников нет.</p>}
         <form className={commonStyles.form} onSubmit={search}><h3>Добавить участника</h3><label className={commonStyles.formGroup}>Никнейм<input className={inputStyles.input} disabled={!memberScope || Boolean(memberAddBlock && !memberAddBlock.exists)} value={nickname} onChange={event => { setNickname(event.target.value); searchSequence.current += 1; setSearchResults(null); }} /></label><button className={buttonStyles.button} type="submit" disabled={!memberScope || Boolean(memberAddBlock && !memberAddBlock.exists)}>Найти</button>{Boolean(searchError) && <ApiError error={searchError} />}{searchResults && <label className={commonStyles.formGroup}>Найденный пользователь<select className={inputStyles.input} disabled={!memberScope || Boolean(memberAddBlock && !memberAddBlock.exists)} value={selectedUserId} onChange={event => { const value = event.target.value; setSelectedUserId(value); if (memberAddBlock?.exists && Number(value) !== memberAddBlock.userId) setMemberAddBlock(undefined); }}><option value="">Выберите пользователя</option>{searchResults.map(user => <option key={user.id} value={user.id}>{user.visibleName} (@{user.nickname})</option>)}</select></label>}</form>
        {Boolean(addError) && <ApiError error={addError} />}{searchResults && <form onSubmit={add}><button className={buttonStyles.button} disabled={!memberScope || !int32(selectedUserId) || addMember.busy || Boolean(memberAddBlock)}>Добавить участника</button></form>}{memberAddBlock && <div role="alert"><p>{memberAddBlock.exists ? 'Запись уже существует. Список обновляется; повторное добавление не отправлено.' : 'Результат добавления участника не подтверждён.'}</p>{Boolean(memberAddBlock.error) && <ApiError error={memberAddBlock.error} />}{!memberAddBlock.exists && <button type="button" className={buttonStyles.button} disabled={!memberScope} onClick={() => void verifyMemberAdd()}>Проверить добавление</button>}</div>}
      </> : <p>{permissionsLoading ? 'Проверка прав на членство…' : 'Список членства доступен только управляющим доступом.'}</p>}
      <h2>Доступ к выбранному персонажу</h2>
      {characters.loading && !characters.data && <p>Загрузка персонажей…</p>}{Boolean(characters.error) && <ApiError error={characters.error} onRetry={characters.reload} />}
      {characters.data && <label>Персонаж<select className={inputStyles.input} value={characterId} onChange={event => selectCharacter(event.target.value)}><option value="">Выберите персонажа</option>{characters.data.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>}
      {characterId && characterPermission.loading && <p>Проверка доступа к персонажу…</p>}{characterId && Boolean(characterPermission.error) && <ApiError error={characterPermission.error} onRetry={characterPermission.reload} />}
      {characterId && characterPermission.data && !characterPermission.data.canManageAccess && <p role="alert">Нет права управления назначениями для этого персонажа.</p>}
      {assignmentDisplayReady && <>
        {(characterPermission.loading || permissionsLoading) && <p>Обновление прав и назначений…</p>}
        {assignments.loading && !assignments.data && <p>Загрузка назначений…</p>}{Boolean(assignments.error) && <ApiError error={assignments.error} onRetry={assignments.reload} />}
        {assignments.data && <div className={styles.page}>{assignments.data.map(row => <AssignmentRow key={`${sessionKey}:${campaignId}:${characterId}:${row.userId}`} campaignId={campaignId} sessionKey={sessionKey} characterId={characterId} row={row} writeAllowed={assignmentReady} onChanged={refresh} />)}
          {memberScope && <form onSubmit={addGrant}><label>Добавить участника<select className={inputStyles.input} disabled={!assignmentReady || Boolean(assignmentAddBlock && !assignmentAddBlock.exists)} value={selectedGrantUserId} onChange={event => { const value = event.target.value; setSelectedGrantUserId(value); if (assignmentAddBlock?.exists && Number(value) !== assignmentAddBlock.userId) setAssignmentAddBlock(undefined); }}><option value="">Выберите участника</option>{members.data?.map(member => <MemberOption key={member.userId} campaignId={campaignId} sessionKey={sessionKey} member={member} />)}</select></label><button className={buttonStyles.button} disabled={!assignmentReady || !int32(selectedGrantUserId) || addAssignment.busy || Boolean(assignmentAddBlock)}>Назначить</button>{Boolean(addAssignment.error) && <ApiError error={addAssignment.error} />}</form>}{assignmentAddBlock && assignmentAddBlock.characterId === characterId && <div role="alert"><p>{assignmentAddBlock.exists ? 'Запись уже существует. Список обновляется; назначение повторно не отправлено.' : 'Результат добавления назначения не подтверждён.'}</p>{Boolean(assignmentAddBlock.error) && <ApiError error={assignmentAddBlock.error} />}{!assignmentAddBlock.exists && <button type="button" className={buttonStyles.button} disabled={!assignmentReady} onClick={() => void verifyAssignmentAdd()}>Проверить добавление</button>}</div>}</div>}
      </>}
    </section>;
};

const AssignmentRow: React.FC<{ campaignId: number; sessionKey: string; characterId: string; row: Assignment; writeAllowed: boolean; onChanged: () => void }> = ({ campaignId, sessionKey, characterId, row, writeAllowed, onChanged }) => {
  const { api } = useWorkspace();
  const profile = useResource<User>(`${sessionKey}:${campaignId}:user:${row.userId}`, () => api.getUser(row.userId));
  const [baseline, setBaseline] = useState({ value: row.canWrite, revision: row.metadataRevision });
  const [canWrite, setCanWrite] = useState(row.canWrite);
  const [frozen, setFrozen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [readError, setReadError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [snapshot, setSnapshot] = useState<Assignment>();
  const dirty = canWrite !== baseline.value;
  const clearDirty = useDirtyDraft(`assignment-${campaignId}-${characterId}-${row.userId}`, dirty);
  const pending = useRef(false);
  const seenRevision = useRef(String(row.metadataRevision));
  const ownSuccessRevision = useRef<string | undefined>(undefined);
  useEffect(() => {
    const nextRevision = String(row.metadataRevision);
    if (seenRevision.current === nextRevision) return;
    seenRevision.current = nextRevision;
    if (ownSuccessRevision.current === nextRevision) { ownSuccessRevision.current = undefined; return; }
    if (!dirty) { setBaseline({ value: row.canWrite, revision: row.metadataRevision }); setCanWrite(row.canWrite); setSnapshot(undefined); setFrozen(false); setSaved(false); }
    else if (nextRevision !== String(baseline.revision)) { setSnapshot(row); setFrozen(true); }
  }, [row, dirty, baseline.revision]);
  const save = useMutation((value: boolean) => api.putAssignment(campaignId, characterId, row.userId, { canWrite: value, expectedRevision: baseline.revision }));
  const remove = useMutation(() => api.deleteAssignment(campaignId, characterId, row.userId, baseline.revision));
   const reread = async () => { setReadError(undefined); try { const list = await api.listAssignments(campaignId, characterId); const current = list.find(item => item.userId === row.userId); if (!current) { setMissing(true); setFrozen(true); setSnapshot(undefined); return; } setMissing(false); setBaseline({ value: current.canWrite, revision: current.metadataRevision }); setSnapshot(current); setFrozen(false); } catch (error) { setReadError(error); setFrozen(true); if (isStatus(error, 403)) onChanged(); } };
  const saveRow = async () => { if (!writeAllowed || frozen || missing || pending.current || save.busy || remove.busy) return; pending.current = true; const submitted = canWrite; try { const result = await save.run(submitted); if (result) { setBaseline({ value: result.canWrite, revision: result.metadataRevision }); setCanWrite(result.canWrite); ownSuccessRevision.current = String(result.metadataRevision); setSnapshot(undefined); setFrozen(false); setMissing(false); setSaved(true); clearDirty(); onChanged(); } } catch (error) { if ((isStatus(error, 409) && !rowConflict(error)) || Boolean(error && typeof error === 'object' && 'unknownOutcome' in error && error.unknownOutcome)) setFrozen(true); if (isStatus(error, 403)) onChanged(); } finally { pending.current = false; } };
   const deleteRow = async () => { if (!writeAllowed || frozen || missing || pending.current || save.busy || remove.busy || !window.confirm('Снять доступ к персонажу? Назначение будет удалено без каскада.')) return; pending.current = true; try { await remove.run(); onChanged(); } catch (error) { if ((isStatus(error, 409) && !rowConflict(error)) || Boolean(error && typeof error === 'object' && 'unknownOutcome' in error && error.unknownOutcome)) setFrozen(true); if (isStatus(error, 403)) onChanged(); } finally { pending.current = false; } };
  return <article className={commonStyles.card}>
    <p>{profile.data ? `${profile.data.visibleName} (@${profile.data.nickname})` : 'Профиль недоступен'} — доступ к персонажу</p>
    {Boolean(profile.error) && <><p>Профиль недоступен.</p><ApiError error={profile.error} /></>}
    <label><input type="checkbox" checked={canWrite} disabled={!writeAllowed || save.busy || remove.busy || pending.current || frozen || missing} onChange={event => { setCanWrite(event.target.checked); setSaved(false); }} /> Может редактировать персонажа</label>
    {saved && <p role="status">Изменения сохранены.</p>}
    {snapshot && <p>Актуальная версия: {snapshot.canWrite ? 'редактирование разрешено' : 'только просмотр'}. Черновик сохранён отдельно.</p>}
    {missing && <p role="alert">Запись отсутствует на сервере. Черновик оставлен только для чтения.</p>}
    {Boolean(save.error) && <ApiError error={save.error} />}
    {Boolean(remove.error) && <ApiError error={remove.error} />}
    {Boolean(readError) && <ApiError error={readError} />}
    {frozen && <div role="alert"><p>Изменение не подтверждено. Перечитайте запись перед повторной операцией.</p><button className={buttonStyles.button} type="button" onClick={() => void reread()}>Перечитать запись</button>{missing && <button type="button" className={buttonStyles.button} onClick={() => { setMissing(false); setFrozen(false); setCanWrite(baseline.value); clearDirty(); onChanged(); }}>Подтвердить отсутствие записи</button>}</div>}
    <div className={commonStyles.formActions}>
      <button className={buttonStyles.button} disabled={!writeAllowed || !dirty || save.busy || remove.busy || pending.current || frozen || missing} onClick={() => void saveRow()}>Сохранить</button>
      <button className={buttonStyles.button} disabled={save.busy || remove.busy || pending.current || missing} onClick={() => { if (dirty && !window.confirm('Отказаться от черновика назначения?')) return; setCanWrite(baseline.value); clearDirty(); }}>Отмена</button>
      <button className={buttonStyles.button} disabled={!writeAllowed || save.busy || remove.busy || pending.current || frozen || missing} onClick={() => void deleteRow()}>Снять доступ</button>
      {(isStatus(save.error, 409) || isStatus(remove.error, 409)) && !frozen && <button type="button" className={buttonStyles.button} onClick={() => void reread()}>Перечитать запись</button>}
    </div>
  </article>;
};

export default Members;
