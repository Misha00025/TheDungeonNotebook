import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VisitHistoryProvider, useVisitHistory, visitHistoryStorageKey } from './VisitHistory';

const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
const Probe: React.FC = () => {
  const history = useVisitHistory();
  return <><output aria-label="History">{JSON.stringify(history.lastVisitedCharacters)}</output><output aria-label="Group">{String(history.lastVisitedGroupId)}</output>{ids.map((id, index) => <button key={id} onClick={() => history.visitCharacter(index + 1, id)}>{`Visit ${index}`}</button>)}<button onClick={() => history.visitCharacter(9, ids[0].toUpperCase())}>Visit duplicate</button><button onClick={() => history.visitCharacter(9, ids[0])}>Visit duplicate lowercase</button><button onClick={() => history.visitGroup(21)}>Visit group</button></>;
};
const view = (sessionKey: string) => <VisitHistoryProvider key={sessionKey} sessionKey={sessionKey}><Probe /></VisitHistoryProvider>;

describe('VisitHistoryProvider', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it('persists valid character visits newest-first, deduplicates GUIDs, caps at four, and remembers the group', async () => {
    render(view('account-a'));
    for (let index = 0; index < ids.length; index++) fireEvent.click(screen.getByRole('button', { name: `Visit ${index}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Visit duplicate' }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(visitHistoryStorageKey('account-a'))!).lastVisitedCharacters).toHaveLength(4));
    expect(JSON.parse(screen.getByLabelText('History').textContent!)).toEqual([{ groupId: 9, characterId: ids[0].toUpperCase() }, { groupId: 5, characterId: ids[4] }, { groupId: 4, characterId: ids[3] }, { groupId: 3, characterId: ids[2] }]);
    expect(screen.getByLabelText('Group')).toHaveTextContent('9');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(screen.getByRole('button', { name: 'Visit duplicate lowercase' }));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Visit group' }));
    expect(screen.getByLabelText('Group')).toHaveTextContent('21');
  });

  it('restores a scoped history on remount and isolates accounts', async () => {
    const first = render(view('account-a'));
    fireEvent.click(screen.getByRole('button', { name: 'Visit 0' }));
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-a'))).toContain(ids[0]));
    first.unmount();
    const second = render(view('account-a'));
    expect(screen.getByLabelText('History')).toHaveTextContent(ids[0]);
    second.rerender(view('account-b'));
    expect(screen.getByLabelText('History')).toHaveTextContent('[]');
    fireEvent.click(screen.getByRole('button', { name: 'Visit 1' }));
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-b'))).toContain(ids[1]));
    expect(window.localStorage.getItem(visitHistoryStorageKey('account-a'))).toContain(ids[0]);
  });

  it('migrates valid legacy GUID visits without modifying original values or adopting numeric IDs', async () => {
    const groupRaw = '12';
    const charactersRaw = JSON.stringify([{ groupId: 12, characterId: ids[0] }, { groupId: 12, characterId: 987 }]);
    window.localStorage.setItem('lastVisitedGroupId', groupRaw);
    window.localStorage.setItem('lastVisitedCharacters', charactersRaw);
    render(view('account-a'));
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-a'))).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem(visitHistoryStorageKey('account-a'))!)).toEqual({ lastVisitedGroupId: 12, lastVisitedCharacters: [{ groupId: 12, characterId: ids[0] }] });
    expect(window.localStorage.getItem('lastVisitedGroupId')).toBe(groupRaw);
    expect(window.localStorage.getItem('lastVisitedCharacters')).toBe(charactersRaw);
    expect(window.localStorage.getItem('tdn.campaign.visits.legacy-owner')).toBe('account-a');
    fireEvent.click(screen.getByRole('button', { name: 'Visit 1' }));
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-a'))).toContain(ids[1]));
    expect(window.localStorage.getItem('lastVisitedCharacters')).toBe(charactersRaw);
  });

  it('migrates a valid legacy group when the legacy character JSON is corrupt without replacing it', async () => {
    const groupRaw = '12';
    const corruptCharactersRaw = '[not valid JSON';
    window.localStorage.setItem('lastVisitedGroupId', groupRaw);
    window.localStorage.setItem('lastVisitedCharacters', corruptCharactersRaw);
    render(view('account-a'));
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-a'))).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem(visitHistoryStorageKey('account-a'))!)).toEqual({ lastVisitedGroupId: 12, lastVisitedCharacters: [] });
    expect(window.localStorage.getItem('lastVisitedGroupId')).toBe(groupRaw);
    expect(window.localStorage.getItem('lastVisitedCharacters')).toBe(corruptCharactersRaw);
  });

  it('does not let a different account adopt unscoped legacy history', async () => {
    window.localStorage.setItem('lastVisitedGroupId', '12');
    window.localStorage.setItem('lastVisitedCharacters', JSON.stringify([{ groupId: 12, characterId: ids[0] }]));
    window.localStorage.setItem('tdn.campaign.visits.legacy-owner', 'account-a');
    render(view('account-b'));
    expect(screen.getByLabelText('History')).toHaveTextContent('[]');
    expect(screen.getByLabelText('Group')).toHaveTextContent('null');
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-b'))).not.toBeNull());
  });

  it('does not claim legacy storage without valid data or write for a null session', async () => {
    window.localStorage.setItem('lastVisitedGroupId', 'not-an-id');
    window.localStorage.setItem('lastVisitedCharacters', JSON.stringify([987]));
    const account = render(view('account-a'));
    await waitFor(() => expect(window.localStorage.getItem(visitHistoryStorageKey('account-a'))).not.toBeNull());
    expect(window.localStorage.getItem('tdn.campaign.visits.legacy-owner')).toBeNull();
    account.unmount();
    const anonymous = render(view('null'));
    expect(window.localStorage.getItem(visitHistoryStorageKey('null'))).toBeNull();
    expect(window.localStorage.getItem('tdn.campaign.visits.legacy-owner')).toBeNull();
    anonymous.unmount();
  });

  it('keeps corrupt scoped data untouched on mount and continues in memory when storage throws', async () => {
    const key = visitHistoryStorageKey('account-a');
    window.localStorage.setItem(key, '{broken');
    const mounted = render(view('account-a'));
    await waitFor(() => expect(screen.getByLabelText('History')).toHaveTextContent('[]'));
    expect(window.localStorage.getItem(key)).toBe('{broken');
    fireEvent.click(screen.getByRole('button', { name: 'Visit 0' }));
    await waitFor(() => expect(window.localStorage.getItem(key)).toContain(ids[0]));
    mounted.unmount();
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    render(view('account-b'));
    fireEvent.click(screen.getByRole('button', { name: 'Visit 0' }));
    expect(screen.getByLabelText('History')).toHaveTextContent(ids[0]);
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
