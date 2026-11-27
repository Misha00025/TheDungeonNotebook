import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Field, Select } from '@tdn/shared';
import { useAcceptedLocation, useWorkspace } from './Workspace';
import type { PlayerCharacterOption } from './types';

export const playerSelectionKey = (sessionKey: string, campaignId: number) => `tdn.player.character.${encodeURIComponent(sessionKey)}.${campaignId}`;

type Props = {
  campaignId: number;
  characterId?: string;
  onChoose: (characterId: string) => void;
  entry?: boolean;
  availableCharacters: PlayerCharacterOption[];
};

export const PlayerCharacterChooser: React.FC<Props> = ({ campaignId, characterId = '', onChoose, entry = false, availableCharacters }) => {
  const { sessionKey, navigate, path } = useWorkspace();
  const eligible = availableCharacters;
  const selectionKey = playerSelectionKey(sessionKey, campaignId);
  const saved = window.localStorage.getItem(selectionKey);
  const initial = eligible.find(character => character.id === saved);
  useEffect(() => {
    if (entry && eligible.length === 1) {
      navigate(path(`/${campaignId}/player/characters/${encodeURIComponent(eligible[0].id)}`), { replace: true });
    } else if (entry && eligible.length > 1 && initial) {
      navigate(path(`/${campaignId}/player/characters/${encodeURIComponent(initial.id)}`), { replace: true });
    }
  }, [entry, eligible, initial, navigate, path, campaignId]);
  const choose = (id: string) => {
    if (!eligible.some(character => character.id === id)) return;
    onChoose(id);
  };
  if (eligible.length < 2) return null;
  const selectedId = eligible.some(character => character.id === characterId) ? characterId : '';
  return <Field label="Персонаж" htmlFor="player-character-chooser"><Select variant="single-line" id="player-character-chooser" value={selectedId} onChange={event => choose(event.target.value)}>
    {entry && <option value="">Выберите персонажа</option>}
    {eligible.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
  </Select></Field>;
};

export function useConfirmedPlayerCharacterSelection(campaignId: number, selectionKey: string, onChoose: (id: string) => void) {
  const location = useAcceptedLocation();
  const actualLocation = useLocation();
  const pending = useRef<{ path: string; id: string } | null>(null);
  const { path } = useWorkspace();
  const acceptedPath = `${location.pathname}${location.search}${location.hash}`;
  const actualPath = `${actualLocation.pathname}${actualLocation.search}${actualLocation.hash}`;
  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    if (acceptedPath === target.path) {
      pending.current = null;
      window.localStorage.setItem(selectionKey, target.id);
    } else if (actualPath === acceptedPath) {
      pending.current = null;
    }
  }, [acceptedPath, actualPath, selectionKey]);
  return (id: string) => {
    const target = path(`/${campaignId}/player/characters/${encodeURIComponent(id)}`);
    pending.current = { path: target, id };
    onChoose(id);
  };
}
