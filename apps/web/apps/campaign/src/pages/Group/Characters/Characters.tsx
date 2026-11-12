import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CharacterShort } from '../../../types/characters';
import { CharacterTemplate } from '../../../types/characterTemplates';
import { charactersAPI, characterTemplatesAPI } from '../../../services/api';
import CharacterModal from './Modals/CharacterModal/CharacterModal';
import { useCampaignNavigate } from '../../../navigation';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import List from '@tdn/shared/ui/List/List';
import CharacterCard from '../Cards/CharacterCard/CharacterCard';
import { useActionPermissions } from '../../../hooks/useActionPermissions';

const Characters: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useCampaignNavigate();
  const [characters, setCharacters] = useState<CharacterShort[]>([]);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { canEditGroup } = useActionPermissions();

  useEffect(() => {
    if (groupId) {
      loadCharacters();
      loadTemplates();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const charactersData = await charactersAPI.getCharacters(parseInt(groupId!));
      setCharacters(charactersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesData = await characterTemplatesAPI.getTemplates(parseInt(groupId!));
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleCreateCharacter = async (characterData: any) => {
    try {
      const newCharacter = await charactersAPI.createCharacter(parseInt(groupId!), characterData);
      navigate(`/groups/${groupId}/character/${newCharacter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create character');
      throw err;
    }
  };

  const handleSelectCharacter = (characterId: number) => {
    navigate(`/groups/${groupId}/character/${characterId}`);
  };

  if (loading) return <div className={commonStyles.container}>Загрузка...</div>;

  return (
    <div className={commonStyles.container}>
      {error && <div className={modalStyles.error}>{error}</div>}
      {canEditGroup && (
        <div className={commonStyles.actions}>
          <button 
            className={buttonStyles.button}
            onClick={() => setIsModalOpen(true)}
            disabled={templates.length === 0}
          >
            Создать персонажа
          </button>
          {templates.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Для создания персонажа сначала создайте хотя бы один шаблон
            </p>
          )}
        </div>
      )}
      <List layout="grid" gap="large">
        {characters.map(character => (
          <CharacterCard
            key={character.id}
            character={character}
            onSelect={() => handleSelectCharacter(character.id)}
          />
        ))}
      </List>

      <CharacterModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateCharacter}
        templates={templates}
        title="Создание персонажа"
      />
    </div>
  );
};

export default Characters;