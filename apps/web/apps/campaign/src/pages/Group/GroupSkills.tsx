// GroupSkills.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GroupSkill, SkillAttributeDefinition } from '../../types/groupSkills';
import { groupAPI, groupSkillsAPI } from '../../services/api';
import { useGroupSchemas } from '../../contexts/GroupSchemasContext';
import SkillCard from './Cards/SkillCard/SkillCard';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import ResourcePage from '../../components/commons/Pages/ResourcePage/ResourcePage';
import SchemaModal from './Modals/ShcemaModal/SchemaModal';
import SkillModal from './Modals/SkillModal/SkillModal';
import { ThemeProvider } from '@tdn/shared/theme/ThemeContext';

const SkillCardWrapper: React.FC<{
  item: GroupSkill;
  onEdit?: (item: GroupSkill) => void;
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

const GroupSkills: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [skills, setSkills] = useState<GroupSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<GroupSkill | null>(null);
  const { canEditGroup } = useActionPermissions();
  const { skillsSchema, refreshSchemas } = useGroupSchemas();
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [attributes, setAttributes] = useState<SkillAttributeDefinition[]>([]);
  const [lastUpdatedSkillId, setLastUpdatedSkillId] = useState<number | null>(null);
  
  useEffect(() => {
    if (groupId) {
      loadSkills();
      loadAttributes();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lastUpdatedSkillId == null) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`skill-${lastUpdatedSkillId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setLastUpdatedSkillId(null);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [lastUpdatedSkillId, skills]);

  const loadAttributes = async () => {
    try {
      const attributesData = await groupSkillsAPI.getSkillAttributes(parseInt(groupId!));
      setAttributes(attributesData);
    } catch (err) {
      console.error('Failed to load attributes:', err);
    }
  };

  const loadSkills = async () => {
    try {
      setLoading(true);
      const skillsData = await groupSkillsAPI.getSkills(parseInt(groupId!));
      setSkills(skillsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = () => {
    setEditingSkill(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (skill: GroupSkill) => {
    setEditingSkill(skill);
    setIsModalOpen(true);
  };
  
  const handleDelete = async (skillId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот навык?')) return;
    
    try {
      await groupSkillsAPI.deleteSkill(parseInt(groupId!), skillId);
      loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill');
    }
  };
  
  const availableAttributes = Array.from(
    new Set(
      skills.flatMap(skill =>
        skill.attributes?.map(attr => attr.name) || []
      )
    )
  ).sort();

  const config = {
    ItemComponent: SkillCardWrapper,
    titles: {
      page: undefined,
    },
    groupByAttributes: skillsSchema.groupBy,
    groupsInitiallyCollapsed: true,
  };

  const handleSaveSkill = async (skillData: any) => {
    let savedSkill: GroupSkill;
    if (editingSkill) {
      savedSkill = await groupSkillsAPI.updateSkill(parseInt(groupId!), editingSkill.id, skillData);
    } else {
      savedSkill = await groupSkillsAPI.createSkill(parseInt(groupId!), skillData);
    }

    setIsModalOpen(false);
    setEditingSkill(null);
    await loadSkills();
    setLastUpdatedSkillId(savedSkill.id);
  };

  const handleConfigureSchema = () => {
    setIsSchemaModalOpen(true);
  };
  
  const handleSaveSchema = async (newSchema: string[]) => {
    try {
      await groupAPI.updateSkillsSchema(parseInt(groupId!), newSchema);
      await refreshSchemas();
      setIsSchemaModalOpen(false);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save schema');
    }
  };

  return (
    <ThemeProvider>
      <ResourcePage
        config={config}
        items={skills}
        loading={loading}
        error={error}
        canCreate={canEditGroup}
        canEdit={canEditGroup}
        canDelete={canEditGroup}
        canConfigureSchema={canEditGroup}
        onConfigureSchema={handleConfigureSchema}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        expandedItemId={lastUpdatedSkillId}
      />
      
      {canEditGroup && (
        <>
        <SkillModal 
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSkill(null);
          }}
          onSave={handleSaveSkill}
          editingSkill={editingSkill}
          title={editingSkill ? 'Редактирование навыка' : 'Создание навыка'}
          availableAttributes={attributes}
          possibleValuesForFilteredAttributes={{}}
        />
        
        <SchemaModal
          isOpen={isSchemaModalOpen}
          onClose={() => setIsSchemaModalOpen(false)}
          onSave={handleSaveSchema}
          availableAttributes={availableAttributes}
          currentSchema={skillsSchema.groupBy}
          title="Настройка схемы группировки навыков"
        />
      </>
      )}
    </ThemeProvider>
  );
};

export default GroupSkills;