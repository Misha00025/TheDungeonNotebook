// pages/CharacterSkills.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CharacterSkill } from '../../../../types/characterSkills';
import { GroupSkill, SkillAttributeDefinition } from '../../../../types/groupSkills';
import { characterSkillsAPI, groupSkillsAPI } from '../../../../services/api';
import SkillCard from '../../Cards/SkillCard/SkillCard';
import { useActionPermissions } from '../../../../hooks/useActionPermissions';
import ResourcePage from '../../../../components/commons/Pages/ResourcePage/ResourcePage';
import CharacterSkillModal from '../../Modals/SkillModal/CharacterSkillModal';
import SkillModal from '../../Modals/SkillModal/SkillModal';
import { useCharacter } from '../../../../contexts/CharacterContext';
import { useGroupSchemas } from '../../../../contexts/GroupSchemasContext';
import { ThemeProvider } from '@tdn/shared/theme/ThemeContext';

const SkillCardWrapper: React.FC<{
  item: CharacterSkill;
  onEdit?: (item: CharacterSkill) => void;
  onDelete?: (id: number) => void;
  showActions?: boolean;
}> = ({ item, onEdit, onDelete, showActions }) => {
  return (
    <SkillCard
      skill={item}
      onEdit={onEdit ? () => onEdit(item) : undefined}
      onDelete={onDelete ? () => onDelete(item.id) : undefined}
      showActions={showActions}
    />
  );
};

const CharacterSkills: React.FC = () => {
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();
  const { skills, setSkills, refreshSkills, skillsLoading } = useCharacter();
  const [error, setError] = useState<string | null>(null);
  const [groupSkills, setGroupSkills] = useState<GroupSkill[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const { canEditThisCharacter, canEditGroup } = useActionPermissions();
  const [attributes, setAttributes] = useState<SkillAttributeDefinition[]>([]);
  const [editingSkill, setEditingSkill] = useState<GroupSkill | null>(null);
  const { skillsSchema } = useGroupSchemas();

  useEffect(() => {
    if (groupId) {
      loadGroupSkills();
      loadAttributes();
      refreshSkills();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const localRefreshSkills = async () => {
    try {
      const fresh = await characterSkillsAPI.getCharacterSkills(parseInt(groupId!), parseInt(characterId!));
      setSkills(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh skills');
    }
  };

  const loadAttributes = async () => {
    try {
      const attributesData = await groupSkillsAPI.getSkillAttributes(parseInt(groupId!));
      setAttributes(attributesData);
    } catch (err) {
      console.error('Failed to load attributes:', err);
    }
  };

  const loadGroupSkills = async () => {
    try {
      const skillsData = await groupSkillsAPI.getSkills(parseInt(groupId!));
      setGroupSkills(skillsData);
    } catch (err) {
      console.error('Failed to load group skills:', err);
    }
  };

  const handleAddSkill = async (skillId: number) => {
    try {
      await characterSkillsAPI.addSkillToCharacter(
        parseInt(groupId!), 
        parseInt(characterId!), 
        skillId
      );
      await localRefreshSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill');
    }
  };

  const handleRemoveSkill = async (skillId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту способность у персонажа?')) return;

    try {
      await characterSkillsAPI.removeSkillFromCharacter(
        parseInt(groupId!), 
        parseInt(characterId!), 
        skillId
      );
      await localRefreshSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove skill');
    }
  };

  const getPossibleValuesForFilteredAttributes = useCallback(() => {
    const possibleValues: { [key: string]: string[] } = {};
    
    attributes
      .filter(attr => attr.isFiltered)
      .forEach(attr => {
        const values = new Set<string>();
        skills.forEach(skill => {
          const skillAttr = skill.attributes.find(a => a.key === attr.key);
          if (skillAttr) {
            values.add(skillAttr.value);
          }
        });
        possibleValues[attr.key] = Array.from(values);
        possibleValues[attr.key].sort();
      });
    return possibleValues;
  }, [skills, attributes]);

  const handleCreateSkill = async (skillData: any) => {
      await groupSkillsAPI.createSkill(parseInt(groupId!), skillData);
      await localRefreshSkills();
    };
  
  const handleUpdateSkill = async (skillData: any) => {
    if (!editingSkill) return;
    await groupSkillsAPI.updateSkill(parseInt(groupId!), editingSkill.id, skillData);
    await localRefreshSkills();
  };

  const handleEditSkill = (skill: GroupSkill) => {
    setEditingSkill(skill);
    setIsSkillModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const config = {
    ItemComponent: SkillCardWrapper,
    titles: {
      page: undefined,
      create: 'Добавить'
    },
    groupByAttributes: skillsSchema.groupBy,
  };

  if (skillsLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <ThemeProvider>
      <ResourcePage
        config={config}
        items={skills as CharacterSkill[]}
        loading={false}
        error={error}
        canCreate={canEditThisCharacter}
        canEdit={canEditThisCharacter}
        canDelete={canEditThisCharacter}
        onCreate={() => setIsModalOpen(true)}
        onEdit={canEditGroup ? handleEditSkill : undefined}
        onDelete={canEditThisCharacter ? handleRemoveSkill : undefined}
      />

      {canEditThisCharacter && (
        <CharacterSkillModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAddSkill={handleAddSkill}
          groupSkills={groupSkills}
          existingSkills={skills as CharacterSkill[]}
          title="Добавление способности персонажу"
        />
      )}

      {canEditGroup && (
        <SkillModal 
          isOpen={isSkillModalOpen}
          onClose={() => {setIsSkillModalOpen(false); setEditingSkill(null)}}
          onSave={editingSkill ? handleUpdateSkill : handleCreateSkill}
          editingSkill={editingSkill}
          availableAttributes={attributes}
          possibleValuesForFilteredAttributes={getPossibleValuesForFilteredAttributes()}
          title={editingSkill ? 'Редактирование навыка' : 'Создание навыка'}
        />
      )}
    </ThemeProvider>
  );
};

export default CharacterSkills;
