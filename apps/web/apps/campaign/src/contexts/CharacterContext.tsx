import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Character } from '../types/characters';
import { CharacterItem } from '../types/characterItems';
import { GroupSkill } from '../types/groupSkills';
import { GroupQuest } from '../types/groupQuests';
import {
  charactersAPI,
  characterItemsAPI,
  characterSkillsAPI,
  characterQuestsAPI,
} from '../services/api';

export interface CharacterContextType {
  character: Character | null;
  items: CharacterItem[];
  skills: GroupSkill[];
  quests: GroupQuest[];
  characterLoading: boolean;
  itemsLoading: boolean;
  skillsLoading: boolean;
  questsLoading: boolean;
  error: string | null;
  refreshCharacter: () => Promise<void>;
  refreshItems: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  refreshQuests: () => Promise<void>;
  setCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  setItems: React.Dispatch<React.SetStateAction<CharacterItem[]>>;
  setSkills: React.Dispatch<React.SetStateAction<GroupSkill[]>>;
  setQuests: React.Dispatch<React.SetStateAction<GroupQuest[]>>;
}

interface CharacterProviderProps {
  groupId: number;
  characterId: number;
  children: React.ReactNode;
}

const CharacterContext = createContext<CharacterContextType | null>(null);

const CharacterProvider: React.FC<CharacterProviderProps> = ({
  groupId,
  characterId,
  children,
}) => {
  const [character, setCharacter] = useState<Character | null>(null);
  const [items, setItems] = useState<CharacterItem[]>([]);
  const [skills, setSkills] = useState<GroupSkill[]>([]);
  const [quests, setQuests] = useState<GroupQuest[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCharacter = useCallback(async () => {
    setCharacterLoading(true);
    try {
      const charData = await charactersAPI.getCharacter(groupId, characterId);
      setCharacter(charData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load character');
    } finally {
      setCharacterLoading(false);
    }
  }, [groupId, characterId]);

  const refreshItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const data = await characterItemsAPI.getCharacterItems(groupId, characterId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [groupId, characterId]);

  const refreshSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const data = await characterSkillsAPI.getCharacterSkills(groupId, characterId);
      setSkills(data);
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setSkillsLoading(false);
    }
  }, [groupId, characterId]);

  const refreshQuests = useCallback(async () => {
    setQuestsLoading(true);
    try {
      const data = await characterQuestsAPI.getCharacterQuests(groupId, characterId);
      setQuests(data);
    } catch (err) {
      console.error('Failed to load quests:', err);
    } finally {
      setQuestsLoading(false);
    }
  }, [groupId, characterId]);

  const value = useMemo(
    () => ({
      character,
      items,
      skills,
      quests,
      characterLoading,
      itemsLoading,
      skillsLoading,
      questsLoading,
      error,
      refreshCharacter,
      refreshItems,
      refreshSkills,
      refreshQuests,
      setCharacter,
      setItems,
      setSkills,
      setQuests,
    }),
    [
      character,
      items,
      skills,
      quests,
      characterLoading,
      itemsLoading,
      skillsLoading,
      questsLoading,
      error,
      refreshCharacter,
      refreshItems,
      refreshSkills,
      refreshQuests,
      setCharacter,
      setItems,
      setSkills,
      setQuests,
    ],
  );

  return (
    <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>
  );
};

const useCharacter = (): CharacterContextType => {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return ctx;
};

export { useCharacter };
export { CharacterProvider };
