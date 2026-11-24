import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionRow, Button, DataTable, DataTableActions, DataTableCell, Field, IconButton, Input, List, ListItem, ModalPortal, Notification, Panel, Select } from '@tdn/shared';
import { useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { useMembersAccess } from './useMembersAccess';
import type { CharacterAccessEntry, MemberOperation } from './useMembersAccess';
import type { Member, User } from './types';
import styles from './Members.module.css';

const int32UserId = (value: number) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const errorCode = (error: unknown) => error && typeof error === 'object' && 'problem' in error && error.problem && typeof error.problem === 'object' && 'code' in error.problem ? error.problem.code : undefined;
const isMemberAssignmentsConflict = (error: unknown) => errorCode(error) === 'member_has_assignments';
const userName = (user?: User) => user?.visibleName?.trim() || user?.nickname?.trim() || 'Профиль недоступен';
const userLabel = (user?: User) => user?.nickname ? `${userName(user)} (@${user.nickname})` : userName(user);

const Crown: React.FC = () => <span className={styles.crown} role="img" aria-label="Гейм-мастер" title="Гейм-мастер"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" /><path d="M5 16h14" /></svg></span>;

const OperationRecovery: React.FC<{ op?: MemberOperation; onRead?: () => void; onRetry?: () => void; onDiscard?: () => void; readLabel: string; disabled?: boolean }> = ({ op, onRead, onRetry, onDiscard, readLabel, disabled = false }) => {
  if (!op || op.busy || (!op.error && op.targetValue === undefined && !op.blocked)) return null;
  return <div className={styles.operationError}>
    {Boolean(op.error) && <ApiError error={op.error} />}
    {op.blocked && onRead && <Button type="button" variant="secondary" size="small" disabled={disabled} onClick={onRead}>{readLabel}</Button>}
    {!op.blocked && onRetry && (op.targetValue !== undefined || op.kind === 'member-add' || op.kind === 'assignment-add') && <ActionRow>
      <Button type="button" variant="secondary" size="small" disabled={disabled || op.busy} onClick={onRetry}>Повторить</Button>
      {onDiscard && <Button type="button" variant="secondary" size="small" disabled={disabled || op.busy} onClick={onDiscard}>Отказаться от изменения</Button>}
    </ActionRow>}
  </div>;
};

const AssignmentLine: React.FC<{ entry: CharacterAccessEntry; userName: string; userId: number; access: ReturnType<typeof useMembersAccess>; participantsLoading: boolean }> = ({ entry, userName: memberName, userId, access, participantsLoading }) => {
  const characterId = entry.character.id;
  const assignment = entry.assignments.find(item => item.userId === userId);
  if (!assignment) return null;
  const op = access.operationForAssignment(characterId, userId);
  const canWrite = op?.kind === 'access' && op.targetValue !== undefined ? op.targetValue : assignment.canWrite;
  const disabled = !access.writable || access.isBusy || participantsLoading || Boolean(access.charsError) || entry.loading || Boolean(entry.error || entry.unavailable) || !entry.permissions?.canManageAccess || Boolean(op?.blocked || op?.busy);
  const remove = () => {
    if (!window.confirm('Снять доступ к персонажу? Назначение будет удалено без каскада.')) return;
    void access.removeAssignment(characterId, userId);
  };
  return <ListItem className={styles.assignmentItem} density="compact">
    <span className={styles.assignmentName}>{entry.character.name}</span>
    <Select aria-label={`Уровень доступа ${entry.character.name} для ${memberName}`} value={canWrite ? 'write' : 'read'} disabled={disabled} onChange={event => void access.setAssignmentAccess(characterId, userId, event.target.value === 'write')}>
      <option value="read">Просмотр</option><option value="write">Редактирование</option>
    </Select>
    <IconButton icon="delete" variant="danger" title={`Снять доступ ${memberName} к ${entry.character.name}`} ariaLabel={`Снять доступ ${memberName} к ${entry.character.name}`} disabled={disabled} onClick={remove} />
    <OperationRecovery op={op} onRead={() => void access.rereadAssignment(characterId, userId)} onRetry={() => void access.retryOperation(access.assignmentOperationKey(characterId, userId))} onDiscard={() => access.discardOperation(access.assignmentOperationKey(characterId, userId))} readLabel={`Перечитать доступ ${memberName} к ${entry.character.name}`} disabled={!access.writable || access.isBusy} />
  </ListItem>;
};

const MemberRow: React.FC<{ member: Member; campaignId: number; sessionKey: string; access: ReturnType<typeof useMembersAccess>; onAssign: (member: Member, displayName: string) => void; charactersComplete: boolean; participantsLoading: boolean; onProfileState: (userId: number, state?: { loading: boolean; failed: boolean }) => void; profileRetryVersion: number }> = ({ member, campaignId, sessionKey, access, onAssign, charactersComplete, participantsLoading, onProfileState, profileRetryVersion }) => {
  const { api } = useWorkspace();
  const profile = useResource<User>(`${sessionKey}:${campaignId}:user:${member.userId}`, () => api.getUser(member.userId));
  const previousRetry = useRef(profileRetryVersion);
  useEffect(() => { onProfileState(member.userId, { loading: profile.loading, failed: Boolean(profile.error) }); }, [member.userId, onProfileState, profile.error, profile.loading]);
  useEffect(() => () => onProfileState(member.userId), [member.userId, onProfileState]);
  useEffect(() => {
    if (previousRetry.current === profileRetryVersion) return;
    previousRetry.current = profileRetryVersion;
    if (profile.error) profile.reload();
  }, [profile.error, profile.reload, profileRetryVersion]);
  const name = profile.data ? userName(profile.data) : 'Участник';
  const visibleProfileName = profile.data ? userLabel(profile.data) : profile.error ? 'Профиль недоступен' : null;
  const assignments = access.characters.filter(entry => entry.assignments.some(item => item.userId === member.userId));
  const op = access.operationForMember(member.userId);
  const memberBlocked = Boolean(op?.blocked);
  const rowDisabled = !access.writable || access.isBusy || participantsLoading || memberBlocked;
  const remove = () => {
    if (!window.confirm('Удалить членство в кампании? Доступы к персонажам автоматически не удаляются.')) return;
    void access.removeMember(member.userId);
  };
  const errorConflict = isMemberAssignmentsConflict(op?.error);
  return <tr aria-label={`Участник ${name}`}>
    <DataTableCell sizing="control">{member.isAdmin ? <Crown /> : null}</DataTableCell>
    <DataTableCell as="th" scope="row" sizing="content">{visibleProfileName && <span>{visibleProfileName}</span>}
      {errorConflict && <Notification kind="error" eventKey={`member-assignments:${member.userId}`}>Нельзя удалить участника: сначала снимите назначения персонажей в его строке.</Notification>}
      {!errorConflict && <OperationRecovery op={op} onRead={() => void access.rereadMember(member.userId)} onRetry={() => void access.retryOperation(access.memberOperationKey(member.userId))} onDiscard={() => access.discardOperation(access.memberOperationKey(member.userId))} readLabel={`Перечитать участника ${name}`} disabled={!access.writable || access.isBusy} />}
    </DataTableCell>
    <DataTableCell><List className={styles.assignmentList} layout="vertical" gap="small" stretch>
      {assignments.map(entry => <AssignmentLine key={entry.character.id} entry={entry} userName={name} userId={member.userId} access={access} participantsLoading={participantsLoading} />)}
      {assignments.length === 0 && charactersComplete && <span>Персонажи не назначены.</span>}
    </List></DataTableCell>
    <DataTableCell sizing="control"><DataTableActions>
      <IconButton icon="add" size="small" title={`Назначить персонажа ${name}`} ariaLabel={`Назначить персонажа ${name}`} disabled={rowDisabled} onClick={() => onAssign(member, name)} />
      <IconButton icon={member.isAdmin ? 'arrow-down' : 'arrow-up'} size="small" title={member.isAdmin ? `Понизить ${name} до игрока` : `Повысить ${name} до ГМ`} ariaLabel={member.isAdmin ? `Понизить ${name} до игрока` : `Повысить ${name} до ГМ`} disabled={rowDisabled || Boolean(op?.blocked || op?.busy)} onClick={() => void access.setMemberRole(member.userId, !member.isAdmin)} />
      <IconButton icon="delete" size="small" variant="danger" title={`Удалить участника ${name}`} ariaLabel={`Удалить участника ${name}`} disabled={rowDisabled || Boolean(op?.blocked || op?.busy)} onClick={remove} />
    </DataTableActions></DataTableCell>
  </tr>;
};

const PendingAdd: React.FC<{ op: MemberOperation; access: ReturnType<typeof useMembersAccess>; memberName?: string; characterName?: string }> = ({ op, access, memberName, characterName }) => {
  if (op.busy) return null;
  const memberAdd = op.kind === 'member-add';
  const title = memberAdd ? 'Добавление участника' : 'Добавление назначения';
  const description = memberAdd ? 'Результат добавления участника не подтверждён.' : 'Результат добавления назначения не подтверждён.';
  const key = memberAdd ? access.memberAddOperationKey(op.userId) : access.assignmentAddOperationKey(op.characterId ?? '', op.userId);
  const retry = () => void access.retryOperation(key);
  const reread = () => memberAdd ? void access.rereadMember(op.userId) : op.characterId ? void access.rereadAssignment(op.characterId, op.userId) : undefined;
  return <Panel className={styles.pendingAdd} density="compact" title={title} headingLevel={3}>
    <p>{memberName ?? 'Участник'}{!memberAdd && ` — ${characterName ?? 'персонаж'}`}</p>
    {op.blocked ? <><Notification kind="warning" eventKey={key}>{description}</Notification>{Boolean(op.error) && <ApiError error={op.error} />}<Button type="button" variant="secondary" onClick={reread} disabled={!access.writable || access.isBusy}>{memberAdd ? 'Проверить добавление участника' : 'Проверить добавление назначения'}</Button></> : <>{Boolean(op.error) && <ApiError error={op.error} />}<ActionRow><Button type="button" variant="secondary" onClick={retry} disabled={!access.writable || access.isBusy}>Повторить</Button><Button type="button" variant="secondary" onClick={() => access.discardOperation(key)} disabled={access.isBusy}>Отказаться</Button></ActionRow></>}
  </Panel>;
};

const AssignmentDialog: React.FC<{ member: Member; memberName: string; isOpen: boolean; access: ReturnType<typeof useMembersAccess>; onClose: () => void; participantsLoading: boolean }> = ({ member, memberName, isOpen, access, onClose, participantsLoading }) => {
  const selectId = useId();
  const [characterId, setCharacterId] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const mounted = useRef(false);
  const activeRef = useRef({ isOpen, memberId: member.userId });
  activeRef.current = { isOpen, memberId: member.userId };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const assignedIds = new Set(access.characters.filter(entry => entry.assignments.some(row => row.userId === member.userId)).map(entry => entry.character.id));
  const currentMemberPresent = access.members.some(item => item.userId === member.userId);
  const available = access.characters.filter(entry => !access.charsError && !entry.loading && !entry.error && !entry.unavailable && entry.permissions?.canManageAccess && !assignedIds.has(entry.character.id));
  const selected = access.characters.find(entry => entry.character.id === characterId);
  const addOp = access.pendingAssignmentAdds.find(([, op]) => op.userId === member.userId && op.characterId === characterId)?.[1];
  const pendingAssignmentBlocked = access.pendingAssignmentAdds.some(([, op]) => op.blocked);
  const close = () => { if (!access.isBusy) onClose(); };
  const submit = async () => {
    if (!currentMemberPresent || assignedIds.has(characterId)) return;
    const originalMemberId = member.userId;
    const originalCharacterId = characterId;
    const result = await access.addAssignment(originalCharacterId, originalMemberId, canWrite);
    if (result && mounted.current && activeRef.current.isOpen && activeRef.current.memberId === originalMemberId) onClose();
  };
  return <ModalPortal isOpen={isOpen} onClose={close} dismissDisabled={access.isBusy} title={`Назначить персонажа ${memberName}`}>
    {access.pendingAssignmentAdds.map(([key, op]) => <PendingAdd key={key} op={op} access={access} memberName={op.userId === member.userId ? memberName : 'Участник'} characterName={access.characters.find(entry => entry.character.id === op.characterId)?.character.name} />)}
    <Field label="Персонаж" htmlFor={selectId}>
      <Select id={selectId} value={characterId} disabled={access.isBusy || Boolean(addOp?.blocked)} onChange={event => setCharacterId(event.target.value)}>
        <option value="">Выберите персонажа</option>{available.map(entry => <option key={entry.character.id} value={entry.character.id}>{entry.character.name}</option>)}
      </Select>
    </Field>
    <Field label="Уровень доступа" htmlFor={`${selectId}-level`}>
      <Select id={`${selectId}-level`} value={canWrite ? 'write' : 'read'} disabled={access.isBusy || Boolean(addOp?.blocked)} onChange={event => setCanWrite(event.target.value === 'write')}>
        <option value="read">Просмотр</option><option value="write">Редактирование</option>
      </Select>
    </Field>
    {!currentMemberPresent && <p role="alert">Участник больше не состоит в кампании.</p>}
    {characterId && assignedIds.has(characterId) && <p role="alert">Участнику уже назначен этот персонаж.</p>}
    <ActionRow className={styles.dialogActions}>
      <Button type="button" variant="secondary" disabled={access.isBusy} onClick={close}>Отмена</Button>
      <Button type="button" disabled={participantsLoading || !currentMemberPresent || !characterId || assignedIds.has(characterId) || !selected || selected.loading || Boolean(access.charsError || selected.error || selected.unavailable) || !selected.permissions?.canManageAccess || !access.writable || access.isBusy || pendingAssignmentBlocked || access.pendingAssignmentAdds.length > 0 || Boolean(addOp?.blocked)} onClick={() => void submit()}>Назначить</Button>
    </ActionRow>
  </ModalPortal>;
};

const MembersPage: React.FC<{ campaignId: number }> = ({ campaignId }) => {
  const { api, sessionKey } = useWorkspace();
  const access = useMembersAccess(campaignId);
  const searchInputId = useId();
  const [nickname, setNickname] = useState('');
  const [searchResults, setSearchResults] = useState<User[] | undefined>();
  const [searchError, setSearchError] = useState<unknown>();
  const [searching, setSearching] = useState(false);
  const [dialogMember, setDialogMember] = useState<{ member: Member; name: string }>();
  const [profileStates, setProfileStates] = useState<Record<number, { loading: boolean; failed: boolean }>>({});
  const [profileRetryVersion, setProfileRetryVersion] = useState(0);
  const profileStatesRef = useRef(profileStates);
  profileStatesRef.current = profileStates;
  const searchSequence = useRef(0);
  const mounted = useRef(false);
  const writableRef = useRef(access.writable);
  writableRef.current = access.writable;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; searchSequence.current += 1; }; }, []);
  const updateProfileState = useCallback((userId: number, next?: { loading: boolean; failed: boolean }) => {
    const current = profileStatesRef.current;
    if (!next) {
      if (!(userId in current)) return;
      const updated = Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== userId));
      profileStatesRef.current = updated;
      setProfileStates(updated);
      return;
    }
    const previous = current[userId];
    if (previous?.loading === next.loading && previous.failed === next.failed) return;
    const updated = { ...current, [userId]: next };
    profileStatesRef.current = updated;
    setProfileStates(updated);
  }, []);
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!access.writable || access.isBusy) return;
    const sequence = ++searchSequence.current;
    setSearching(true); setSearchResults(undefined); setSearchError(undefined);
    try {
      const result = await api.searchUsers(nickname);
      if (mounted.current && writableRef.current && sequence === searchSequence.current) setSearchResults(result.filter(user => int32UserId(user.id)));
    } catch (error) {
      if (mounted.current && writableRef.current && sequence === searchSequence.current) setSearchError(error);
    } finally { if (mounted.current && sequence === searchSequence.current) setSearching(false); }
  };
  const memberIds = new Set(access.members.map(item => item.userId));
  const charactersComplete = !access.charsLoading && !access.charsError && access.characters.every(entry => !entry.loading && !entry.error && !entry.unavailable && entry.permissions?.canManageAccess);
  const profilesLoading = access.listLoading || access.members.some(member => profileStates[member.userId]?.loading ?? true);
  const assignmentsLoading = access.charsLoading || access.characters.some(entry => entry.loading);
  const participantsLoading = profilesLoading || assignmentsLoading;
  const profilesFailed = access.members.some(member => profileStates[member.userId]?.failed);
  const openAssignment = (member: Member, name: string) => setDialogMember({ member, name });
  const closeAssignment = () => setDialogMember(undefined);
  const pendingMemberAdds = access.pendingMemberAdds;
  const pendingAssignmentAdds = access.pendingAssignmentAdds;
  const processing = access.displayAllowed && (participantsLoading || access.isBusy || searching || !access.writable);
  const assignmentErrors = Boolean(access.charsError || access.characters.some(entry => Boolean(entry.error || entry.unavailable)));
  const sectionReadErrorsSettled = access.displayAllowed && !participantsLoading && !processing;
  return <section className={styles.page} aria-busy={participantsLoading || access.isBusy || searching || undefined}>
    {access.feedback ? <Notification kind={access.feedback.kind} eventKey={String(access.feedback.event)}>{access.feedback.message}</Notification> : null}
    {sectionReadErrorsSettled && (assignmentErrors || profilesFailed) && <Notification kind="warning" eventKey={`members-section-read:${sessionKey}:${campaignId}`}>{assignmentErrors && profilesFailed ? 'Не все данные списка участников доступны.' : assignmentErrors ? 'Не все назначения доступны.' : 'Не все профили доступны.'}</Notification>}
    {!access.displayAllowed && <p>Список членства доступен только управляющим доступом.</p>}
    {access.displayAllowed && <>
      <Panel title="Добавить участника" headingLevel={2} className={styles.addPanel} aria-busy={searching || undefined}>
        <form className={styles.searchForm} aria-busy={searching || undefined} onSubmit={event => void search(event)}>
          <Field label="Никнейм" htmlFor={searchInputId} className={styles.searchField}>
            <Input id={searchInputId} value={nickname} disabled={!access.writable || access.isBusy} onChange={event => { setNickname(event.target.value); searchSequence.current += 1; setSearching(false); setSearchResults(undefined); setSearchError(undefined); }} />
          </Field>
          <Button type="submit" variant="secondary" disabled={!access.writable || access.isBusy || searching} busy={searching}>Найти</Button>
        </form>
        {Boolean(searchError) && <ApiError error={searchError} />}
        {searchResults && searchResults.length === 0 && <p>Ничего не найдено.</p>}
        {searchResults && searchResults.length > 0 && <List className={styles.searchResults} layout="vertical" gap="small" stretch aria-label="Результаты поиска участников">
          {searchResults.map(user => {
            const alreadyMember = memberIds.has(user.id);
            const name = userLabel(user);
            return <Panel key={user.id} density="compact" className={styles.searchResult}>
              <div className={styles.searchCardContent}>
                <span>{name}</span>
              <IconButton icon="add" title={`Добавить участника ${userName(user)}`} ariaLabel={`Добавить участника ${userName(user)}`} disabled={participantsLoading || alreadyMember || !access.writable || access.isBusy || pendingMemberAdds.length > 0} onClick={() => void access.addMember(user.id)} />
                {alreadyMember && <span>Уже в кампании</span>}
              </div>
            </Panel>;
          })}
        </List>}
      </Panel>
      {pendingMemberAdds.map(([key, op]) => <PendingAdd key={key} op={op} access={access} memberName={searchResults?.find(user => user.id === op.userId) ? userName(searchResults.find(user => user.id === op.userId)) : undefined} />)}
      {pendingAssignmentAdds.length > 0 && !dialogMember && pendingAssignmentAdds.map(([key, op]) => <PendingAdd key={key} op={op} access={access} memberName="Участник" characterName={access.characters.find(entry => entry.character.id === op.characterId)?.character.name} />)}
      {Boolean(access.listError) && <ApiError error={access.listError} onRetry={access.reload} />}
      {sectionReadErrorsSettled && assignmentErrors && <Button type="button" variant="secondary" size="small" disabled={!access.writable || access.isBusy} onClick={access.reload}>Повторить загрузку назначений</Button>}
      {sectionReadErrorsSettled && profilesFailed && <Button type="button" variant="secondary" size="small" disabled={!access.writable || access.isBusy} onClick={() => setProfileRetryVersion(version => version + 1)}>Повторить загрузку профилей</Button>}
      {!access.listLoading && !access.listError && access.members.length === 0 && <p>Участников нет.</p>}
      <DataTable aria-label="Участники кампании" aria-busy={participantsLoading || access.isBusy || undefined}>
        <thead><tr><DataTableCell as="th" scope="col" sizing="control">#</DataTableCell><DataTableCell as="th" scope="col" sizing="content">Имя</DataTableCell><DataTableCell as="th" scope="col">Персонажи</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Действия</DataTableCell></tr></thead>
        <tbody>{access.members.map(member => <MemberRow key={`${campaignId}:${member.userId}`} member={member} campaignId={campaignId} sessionKey={sessionKey} access={access} onAssign={openAssignment} charactersComplete={charactersComplete} participantsLoading={participantsLoading} onProfileState={updateProfileState} profileRetryVersion={profileRetryVersion} />)}</tbody>
      </DataTable>
      {dialogMember && <AssignmentDialog member={dialogMember.member} memberName={dialogMember.name} isOpen access={access} onClose={closeAssignment} participantsLoading={participantsLoading} />}
    </>}
  </section>;
};

const Members: React.FC = () => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { sessionKey } = useWorkspace();
  return <MembersPage key={`${sessionKey}:${campaignId}`} campaignId={campaignId} />;
};

export default Members;
