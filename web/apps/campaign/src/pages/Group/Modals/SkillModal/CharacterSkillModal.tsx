// components/Modals/SkillModal/CharacterSkillModal.tsx
import React, { useState, useEffect } from 'react';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import SearchBar from '@tdn/shared/ui/Search/SearchBar';
import { GroupSkill } from '../../../../types/groupSkills';
import SkillCard from '../../Cards/SkillCard/SkillCard';
import { CharacterSkill } from '../../../../types/characterSkills';

interface CharacterSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSkill: (skillId: number) => void;
  groupSkills: GroupSkill[];
  existingSkills: CharacterSkill[];
  title: string;
}

const CharacterSkillModal: React.FC<CharacterSkillModalProps> = ({
  isOpen,
  onClose,
  onAddSkill,
  groupSkills,
  existingSkills,
  title
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSkills, setFilteredSkills] = useState<GroupSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<GroupSkill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let result = groupSkills.filter(skill => 
      !existingSkills.some(existing => existing.id === skill.id)
    );

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(skill => 
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term) ||
        skill.attributes.some(attr => 
          attr.name.toLowerCase().includes(term) ||
          attr.value.toLowerCase().includes(term)
        )
      );
    }

    setFilteredSkills(result);
  }, [groupSkills, existingSkills, searchTerm, isOpen]);

  const handleSelectSkill = (skill: GroupSkill) => {
    setSelectedSkill(skill);
  };

  const handleBack = () => {
    setSelectedSkill(null);
  };

  const handleAdd = async () => {
    if (!selectedSkill) return;
    setLoading(true);
    setError(null);

    try {
      await onAddSkill(selectedSkill.id);
      // После добавления возвращаемся к списку
      setSelectedSkill(null);
      setSearchTerm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
        <h2>{title}</h2>
        {!selectedSkill && (
          <div className={modalStyles.topPanel}>
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Поиск способности..."
              showClearButton={false}
            />
          </div>
        )}
        <div className={modalStyles.modalBody}>
        {error && <div className={modalStyles.error}>{error}</div>}

        {!selectedSkill ? (
          <>
            {filteredSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onSelect={() => handleSelectSkill(skill)}
                showActions={false}
              />
            ))}
            {filteredSkills.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                Нет доступных способностей для добавления
              </p>
            )}
          </>
        ) : (
          <SkillCard
            skill={selectedSkill}
            showActions={false}
          />
        )}

        </div>
        <div className={modalStyles.buttons}>
          {!selectedSkill ? (
            <button type="button" onClick={onClose} className={buttonStyles.button}>
              Закрыть
            </button>
          ) : (
            <>
              <button type="button" onClick={handleBack} className={buttonStyles.button}>
                ← Назад
              </button>
              <button
                type="button"
                className={buttonStyles.button}
                onClick={handleAdd}
                disabled={loading}
              >
                {loading ? 'Добавление...' : 'Добавить'}
              </button>
            </>
          )}
        </div>

    </ModalPortal>
  );
};

export default CharacterSkillModal;
