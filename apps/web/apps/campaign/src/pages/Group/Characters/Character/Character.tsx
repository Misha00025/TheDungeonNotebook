import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { characterCommandsAPI } from '../../../../services/api';
import commonStyles from '@tdn/shared/styles/common.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import uiStyles from './Character.module.css';
import { TemplateField } from '../../../../types/characterTemplates';
import CharacterTableView from '../CharacterTableView/CharacterTableView';
import { CategoryData } from '../../../../utils/characterFields';
import { MenuItem } from '@tdn/shared/ui/DropdownMenu/DropdownMenu';
import { useActionPermissions } from '../../../../hooks/useActionPermissions';
import { TemplateEditContext, TemplateEditContextType } from '../../../../contexts/TemplateEditContext';
import TemplateFieldModal from '../Modals/CharacterFieldModal/TemplateFieldModal';
import { useCharacter } from '../../../../contexts/CharacterContext';
import { useGroupSchemas } from '../../../../contexts/GroupSchemasContext';

const Character: React.FC = () => {
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();
  const { character, setCharacter, refreshCharacter } = useCharacter();
  const { template, templateSchema } = useGroupSchemas();
  const [error, setError] = useState<string | null>(null);
  const {canEditCharacterFields} = useActionPermissions();
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<{ field: TemplateField | null; fieldKey: string }>({ field: null, fieldKey: '' });

  useEffect(() => {
    refreshCharacter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateFieldValue = async (fieldKey: string, newValue: string) => {
    if (!character) return;

    try {
      if (character.fields[fieldKey]) {
        const result = await characterCommandsAPI.executeCommand(
          Number(groupId),
          Number(characterId),
          {
            type: 'UpdateField',
            payload: { key: fieldKey, field: { ...character.fields[fieldKey], value: Number(newValue) } }
          }
        );
        setCharacter(result);
      } else {
        const result = await characterCommandsAPI.executeCommand(
          Number(groupId),
          Number(characterId),
          {
            type: 'AddField',
            payload: { key: fieldKey, field: { value: Number(newValue) } }
          }
        );
        setCharacter(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field value');
    }
  };

  const handleDeleteField = async (fieldKey: string) => {
    try {
      const result = await characterCommandsAPI.executeCommand(
        Number(groupId),
        Number(characterId),
        { type: 'DeleteField', payload: { key: fieldKey } }
      );
      setCharacter(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete field');
    }
  }

  const getCategoryMenuItems = (category: CategoryData): MenuItem[] => {
    const items: MenuItem[] = [];
    if (canEditCharacterFields){
      const fields = category.fields.filter(([key, val]) => val.value === 0 && !val.maxValue && template?.fields[key] !== undefined)
      if (fields.length > 0){
        fields.map(([key, value]) => 
          items.push({
            label: `Добавить '${value.name}'`,
            onClick: () => { handleUpdateFieldValue(key, '1') },
          })
        );
      }
    }
    return items;
  };

  const handleSaveField = async (field: TemplateField, fieldKey: string) => {
    if (!character) return;
    try {
      if (character.fields[fieldKey]) {
        const result = await characterCommandsAPI.executeCommand(
          Number(groupId),
          Number(characterId),
          { type: 'UpdateField', payload: { key: fieldKey, field } }
        );
        setCharacter(result);
      } else {
        const result = await characterCommandsAPI.executeCommand(
          Number(groupId),
          Number(characterId),
          { type: 'AddField', payload: { key: fieldKey, field } }
        );
        setCharacter(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save field');
    }
    
    setIsFieldModalOpen(false);
    setEditingField({ field: null, fieldKey: '' });
  };

  if (!character) return <div className={commonStyles.container}>Персонаж не найден</div>;

  const conf: TemplateEditContextType = {
    editMode: canEditCharacterFields,
    onEditField: (key) => { setEditingField({fieldKey: key, field: character.fields[key]}); setIsFieldModalOpen(true) },
    onDeleteField: handleDeleteField
  }

  return (
    <div className={commonStyles.container}>
      {error && <div className={modalStyles.error}>{error}</div>}
      
      <div className={uiStyles.fields} style={{ marginTop: '0px' }}>
        <TemplateEditContext value={conf}>
          <CharacterTableView
            character={character}
            template={template}
            schema={templateSchema}
            canEdit={canEditCharacterFields}
            canEditCategories={false}
            onUpdateFieldValue={handleUpdateFieldValue}
            getCategoryMenuItems={getCategoryMenuItems}
            hideZero={true}
          />
        </TemplateEditContext>
      </div>
      <TemplateFieldModal
        isOpen={isFieldModalOpen && editingField.field !== null}
        onClose={() => {
          setIsFieldModalOpen(false);
          setEditingField({ field: null, fieldKey: '' });
        }}
        onSave={handleSaveField}
        field={editingField.field}
        fieldKey={editingField.fieldKey}
        title={`Редактирование поля ${editingField.field?.name}`}
        fullEditMode={false}
      />
    </div>


  );
};

export default Character;