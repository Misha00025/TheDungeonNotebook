import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type CharacterVisit = { groupId: number; characterId: string };
export type VisitHistory = { lastVisitedGroupId: number | null; lastVisitedCharacters: CharacterVisit[] };
type VisitContextValue = VisitHistory & { visitGroup: (groupId: number) => void; visitCharacter: (groupId: number, characterId: string) => void };
type LoadedHistory = { history: VisitHistory; migration?: VisitHistory; malformed: boolean };

const emptyHistory = (): VisitHistory => ({ lastVisitedGroupId: null, lastVisitedCharacters: [] });
const validGroupId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const validGuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const visitHistoryStorageKey = (sessionKey: string) => `tdn.campaign.visits.v1:${sessionKey}`;
const ownerStorageKey = 'tdn.campaign.visits.legacy-owner';
const legacyGroupStorageKey = 'lastVisitedGroupId';
const legacyCharactersStorageKey = 'lastVisitedCharacters';

const normalize = (value: unknown): VisitHistory => {
  if (!value || typeof value !== 'object') return emptyHistory();
  const record = value as Record<string, unknown>;
  const seen = new Set<string>();
  const characters: CharacterVisit[] = [];
  if (Array.isArray(record.lastVisitedCharacters)) {
    for (const item of record.lastVisitedCharacters) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      if (!validGroupId(entry.groupId) || !validGuid(entry.characterId)) continue;
      const normalizedId = entry.characterId.toLowerCase();
      if (seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      characters.push({ groupId: entry.groupId, characterId: entry.characterId });
      if (characters.length === 4) break;
    }
  }
  return { lastVisitedGroupId: validGroupId(record.lastVisitedGroupId) ? record.lastVisitedGroupId : null, lastVisitedCharacters: characters };
};

const parseLegacy = (storage: Storage): VisitHistory | undefined => {
  const read = (key: string) => {
    try {
      const raw = storage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  };
  const legacy = normalize({ lastVisitedGroupId: read(legacyGroupStorageKey), lastVisitedCharacters: read(legacyCharactersStorageKey) });
  return legacy.lastVisitedGroupId !== null || legacy.lastVisitedCharacters.length ? legacy : undefined;
};

const readHistory = (sessionKey: string): LoadedHistory => {
  const fallback = emptyHistory();
  if (sessionKey === 'null') return { history: fallback, malformed: false };
  try {
    const storage = window.localStorage;
    const scopedRaw = storage.getItem(visitHistoryStorageKey(sessionKey));
    if (scopedRaw !== null) {
      try { return { history: normalize(JSON.parse(scopedRaw)), malformed: false }; }
      catch { return { history: fallback, malformed: true }; }
    }
    let owner: string | null;
    try { owner = storage.getItem(ownerStorageKey); } catch { return { history: fallback, malformed: false }; }
    if (owner !== null && owner !== sessionKey) return { history: fallback, malformed: false };
    const migration = parseLegacy(storage);
    return { history: migration ?? fallback, migration, malformed: false };
  } catch {
    return { history: fallback, malformed: false };
  }
};

const VisitHistoryContext = createContext<VisitContextValue | null>(null);

export const VisitHistoryProvider: React.FC<React.PropsWithChildren<{ sessionKey: string }>> = ({ sessionKey, children }) => {
  const [loaded] = useState(() => readHistory(sessionKey));
  const [history, setHistory] = useState(loaded.history);
  const historyRef = useRef(loaded.history);
  const visited = useRef(false);
  const migrationResolved = useRef(false);
  const visitGroup = useCallback((groupId: number) => {
    if (!validGroupId(groupId)) return;
    visited.current = true;
    const current = historyRef.current;
    if (current.lastVisitedGroupId === groupId) return;
    const next = { ...current, lastVisitedGroupId: groupId };
    historyRef.current = next;
    setHistory(next);
  }, []);
  const visitCharacter = useCallback((groupId: number, characterId: string) => {
    if (!validGroupId(groupId) || !validGuid(characterId)) return;
    visited.current = true;
    const current = historyRef.current;
    const currentTop = current.lastVisitedCharacters[0];
    if (current.lastVisitedGroupId === groupId && currentTop?.groupId === groupId && currentTop.characterId.toLowerCase() === characterId.toLowerCase()) return;
    const characters = [{ groupId, characterId }, ...current.lastVisitedCharacters.filter(item => item.characterId.toLowerCase() !== characterId.toLowerCase())].slice(0, 4);
    if (current.lastVisitedGroupId === groupId && current.lastVisitedCharacters.length === characters.length && current.lastVisitedCharacters.every((item, index) => item.groupId === characters[index].groupId && item.characterId === characters[index].characterId)) return;
    const next = { lastVisitedGroupId: groupId, lastVisitedCharacters: characters };
    historyRef.current = next;
    setHistory(next);
  }, []);
  useEffect(() => {
    if (sessionKey === 'null') return;
    let storage: Storage;
    try { storage = window.localStorage; } catch { return; }
    if (loaded.migration && !migrationResolved.current) {
      let owner: string | null;
      try { owner = storage.getItem(ownerStorageKey); } catch { return; }
      if (owner !== null && owner !== sessionKey) {
        migrationResolved.current = true;
        const empty = emptyHistory();
        historyRef.current = empty;
        setHistory(empty);
        return;
      }
      try {
        storage.setItem(visitHistoryStorageKey(sessionKey), JSON.stringify(historyRef.current));
      } catch { return; }
      migrationResolved.current = true;
      try { storage.setItem(ownerStorageKey, sessionKey); } catch {}
      return;
    }
    if (loaded.malformed && !visited.current) return;
    try { storage.setItem(visitHistoryStorageKey(sessionKey), JSON.stringify(historyRef.current)); } catch {}
  }, [history, loaded, sessionKey]);
  const value = useMemo(() => ({ ...history, visitGroup, visitCharacter }), [history, visitGroup, visitCharacter]);
  return <VisitHistoryContext.Provider value={value}>{children}</VisitHistoryContext.Provider>;
};

export const useVisitHistory = () => {
  const value = useContext(VisitHistoryContext);
  if (!value) throw new Error('useVisitHistory requires VisitHistoryProvider');
  return value;
};
