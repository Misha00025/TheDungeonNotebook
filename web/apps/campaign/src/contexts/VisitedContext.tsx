import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface VisitedCharacterEntry {
  groupId: number;
  characterId: number;
}

interface VisitedContextType {
  lastVisitedGroupId: number | null;
  lastVisitedCharacters: VisitedCharacterEntry[];
  visitGroup: (groupId: number) => void;
  visitCharacter: (groupId: number, characterId: number) => void;
  clearVisited: () => void;
}

const VisitedContext = createContext<VisitedContextType | undefined>(undefined);

const LS_GROUP_KEY = 'lastVisitedGroupId';
const LS_CHARACTERS_KEY = 'lastVisitedCharacters';

export const VisitedProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lastVisitedGroupId, setLastVisitedGroupId] = useState<number | null>(null);
  const [lastVisitedCharacters, setLastVisitedCharacters] = useState<VisitedCharacterEntry[]>([]);

  useEffect(() => {
    const savedGroupId = localStorage.getItem(LS_GROUP_KEY);
    if (savedGroupId) setLastVisitedGroupId(Number(savedGroupId));

    try {
      const saved = localStorage.getItem(LS_CHARACTERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setLastVisitedCharacters(parsed);
        }
      }
    } catch {
      setLastVisitedCharacters([]);
    }
  }, []);

  const visitGroup = (groupId: number) => {
    setLastVisitedGroupId(groupId);
    localStorage.setItem(LS_GROUP_KEY, String(groupId));
  };

  const visitCharacter = (groupId: number, characterId: number) => {
    visitGroup(groupId);

    setLastVisitedCharacters(prev => {
      const filtered = prev.filter(e => e.characterId !== characterId);
      const updated = [{ groupId, characterId }, ...filtered].slice(0, 4);
      localStorage.setItem(LS_CHARACTERS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearVisited = () => {
    setLastVisitedGroupId(null);
    setLastVisitedCharacters([]);
    localStorage.removeItem(LS_GROUP_KEY);
    localStorage.removeItem(LS_CHARACTERS_KEY);
  };

  return (
    <VisitedContext.Provider value={{
      lastVisitedGroupId,
      lastVisitedCharacters,
      visitGroup,
      visitCharacter,
      clearVisited,
    }}>
      {children}
    </VisitedContext.Provider>
  );
};

export const useVisited = () => {
  const context = useContext(VisitedContext);
  if (context === undefined) {
    throw new Error('useVisited must be used within a VisitedProvider');
  }
  return context;
};
