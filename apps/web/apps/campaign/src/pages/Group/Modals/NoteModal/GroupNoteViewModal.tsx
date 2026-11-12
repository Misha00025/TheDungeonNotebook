import React from 'react';
import ReactMarkdown from 'react-markdown';
import { GroupNote } from '../../../../types/groupNotes';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import { usePlatform } from '../../../../hooks/usePlatform';

interface GroupNoteViewModalProps {
  note: GroupNote | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const GroupNoteViewModal: React.FC<GroupNoteViewModalProps> = ({ 
  note, 
  onClose, 
  onEdit, 
  onDelete, 
  canEdit = false,
  canDelete = false
}) => {
  const isMobile = usePlatform();

  if (!note) {
    return (
      <ModalPortal isOpen={!!note} onClose={onClose}>
        <p>Загрузка заметки...</p>
      </ModalPortal>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ModalPortal isOpen={!!note} onClose={onClose}>
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <button className={buttonStyles.button} onClick={onClose} type="button">
            ✕ Закрыть
          </button>
        </div>
      )}

      <h2 style={{ margin: '0 0 0.5rem 0' }}>{note.header}</h2>
      <div className={modalStyles.modalBody}>
      
      {note.short_description && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {note.short_description}
        </p>
      )}

      {note.body && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: '1rem',
          overflow: 'auto',
        }}>
          <ReactMarkdown>{note.body}</ReactMarkdown>
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        marginBottom: '0.5rem'
      }}>
        <span>Создано: {formatDate(note.created_at)}</span>
        <span>Обновлено: {formatDate(note.updated_at)}</span>
      </div>

      {note.keywords && note.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {note.keywords.map((keyword, idx) => (
            <span key={idx} style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.8rem',
            }}>
              {keyword}
            </span>
          ))}
        </div>
      )}

      {isMobile && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          {canEdit && onEdit && (
            <IconButton icon="edit" onClick={onEdit} title="Редактировать" size="medium" variant="primary" />
          )}
          {canDelete && onDelete && (
            <IconButton icon="delete" onClick={onDelete} title="Удалить" size="medium" variant="danger" />
          )}
          <button type="button" className={buttonStyles.button} onClick={onClose} style={{ marginLeft: 'auto' }}>
            Закрыть
          </button>
        </div>
      )}

      </div>
      {!isMobile && (
        <div className={modalStyles.buttons}>
          <div style={{ display: 'flex', gap: '0.5rem', marginRight: 'auto' }}>
            {canEdit && onEdit && (
              <IconButton icon="edit" onClick={onEdit} title="Редактировать" size="small" variant="primary" />
            )}
            {canDelete && onDelete && (
              <IconButton icon="delete" onClick={onDelete} title="Удалить" size="small" variant="danger" />
            )}
          </div>
          <button type="button" className={buttonStyles.button} onClick={onClose}>
            Закрыть
          </button>
        </div>
      )}
    </ModalPortal>
  );
};

export default GroupNoteViewModal;
