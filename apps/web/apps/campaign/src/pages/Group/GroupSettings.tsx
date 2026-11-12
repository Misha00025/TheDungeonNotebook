import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Group } from '../../types/group';
import { useGroup } from '../../contexts/GroupContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { groupAPI, characterTemplatesAPI } from '../../services/api';
import { CharacterTemplate } from '../../types/characterTemplates';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import styles from './GroupSettings.module.css';
import GroupEditModal from '../../components/Modals/CreateGroupModal/EditGroupModal';
import List from '@tdn/shared/ui/List/List';
import { usePlatform } from '../../hooks/usePlatform';
import CharacterResourcesModal from './Modals/ResourcesModal/CharacterResourcesModal';

const GroupSettings: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { selectedGroup, setSelectedGroup } = useGroup();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { isGroupAdmin } = usePermissions();
  const isMobile = usePlatform();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [isResourcesModalOpen, setIsResourcesModalOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!groupId) return;
    try {
      const templatesData = await characterTemplatesAPI.getTemplates(parseInt(groupId));
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, [groupId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleGroupUpdated = (updatedGroup: Group) => {
    setSelectedGroup(updatedGroup);
  };

  const handleExport = useCallback(async () => {
    if (!groupId || isExporting) return;
    setIsExporting(true);
    try {
      const data = await groupAPI.exportGroup(Number(groupId));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `group-${groupId}-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Ошибка при экспорте данных группы');
    } finally {
      setIsExporting(false);
    }
  }, [groupId, isExporting]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId || isImporting) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await groupAPI.importGroup(Number(groupId), data);
      alert(`Импорт завершён:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Ошибка при импорте данных. Убедитесь, что файл является корректным экспортом группы.');
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [groupId, isImporting]);

  if (!selectedGroup) return <div className={commonStyles.container}>Загрузка...</div>;

  return (
    <div className={commonStyles.container}>
      <h2>Управление</h2>
      <div className={`${styles.settingsSection} ${isMobile ? commonStyles.footer : ''}`}>
        <div className={styles.settingsList}>
          <List>
            {isGroupAdmin && (
              <button
                className={`${buttonStyles.button} ${commonStyles.link}`}
                onClick={() => setIsEditModalOpen(true)}
              >
                Редактировать группу
              </button>
            )}
            <Link
              to={`/groups/${groupId}/users`}
              className={`${commonStyles.link}`}
            >
              Пользователи
            </Link>
            <Link
              to={`/groups/${groupId}/templates`}
              className={`${commonStyles.link}`}
            >
              Шаблоны
            </Link>
            <button
              className={`${buttonStyles.button} ${commonStyles.link}`}
              onClick={() => setIsResourcesModalOpen(true)}
            >
              Поля на главной персонажа
            </button>
          </List>
        </div>
      </div>

      {isGroupAdmin && (
        <>
          <h2 style={{ marginTop: '2rem', textAlign: 'center' }}>Экспорт/Импорт данных</h2>
          <div className={`${styles.settingsSection} ${isMobile ? commonStyles.footer : ''}`}>
            <div className={styles.settingsList}>
              <List>
                <button
                  className={`${buttonStyles.button} ${commonStyles.link}`}
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? 'Экспорт...' : 'Экспорт данных'}
                </button>
                <button
                  className={`${buttonStyles.button} ${commonStyles.link}`}
                  onClick={handleImportClick}
                  disabled={isImporting}
                >
                  {isImporting ? 'Импорт...' : 'Импорт данных'}
                </button>
              </List>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </>
      )}

      {selectedGroup && isGroupAdmin && (
        <GroupEditModal
          group={selectedGroup}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
      <CharacterResourcesModal
        isOpen={isResourcesModalOpen}
        onClose={() => setIsResourcesModalOpen(false)}
        groupId={Number(groupId)}
        templates={templates}
      />
    </div>
  );
};

export default GroupSettings;
