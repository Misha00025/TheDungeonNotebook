import React, { useState } from 'react';
import { CreateGroupRequest, Group } from '../../../types/group';
import { groupAPI } from '../../../services/api';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const groupData: CreateGroupRequest = {
        name,
        description: description || undefined,
        icon: icon || undefined,
      };
      
      const newGroup = await groupAPI.createGroup(groupData);
      onGroupCreated(newGroup);
      onClose();
      
      // Сброс формы
      setName('');
      setDescription('');
      setIcon('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };


  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
        
        <h2>Создать группу</h2>
        <form onSubmit={handleSubmit}>
        <div className={modalStyles.modalBody}>
        
        {error && <div className={modalStyles.error}>{error}</div>}
        
          <div className={modalStyles.formGroup}>
            <label>Название группы:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputStyles.input}
              required
            />
          </div>
          
          <div className={modalStyles.formGroup}>
            <label>Описание (опционально):</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputStyles.input}
              rows={3}
            />
          </div>
          
          <div className={modalStyles.formGroup}>
            <label>Ссылка на иконку (опционально):</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className={inputStyles.input}
            />
          </div>
          
          </div>
          <div className={modalStyles.buttons}>
            <button type="button" onClick={onClose} className={buttonStyles.button}>
              Отмена
            </button>
            <button type="submit" className={buttonStyles.button} disabled={loading}>
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
          </form>

  </ModalPortal>
  );
};

export default CreateGroupModal;