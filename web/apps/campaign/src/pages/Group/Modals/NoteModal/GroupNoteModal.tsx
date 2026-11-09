import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import { useTheme, getEditorColorMode } from '@tdn/shared/theme/ThemeContext';
import { GroupNote, CreateGroupNoteRequest } from '../../../../types/groupNotes';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface GroupNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateGroupNoteRequest) => Promise<void>;
  editingNote?: GroupNote | null;
  title: string;
}

const GroupNoteModal: React.FC<GroupNoteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingNote,
  title
}) => {
  const [header, setHeader] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [body, setBody] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { themeConfig } = useTheme();

  useEffect(() => {
    if (editingNote) {
      setHeader(editingNote.header);
      setShortDescription(editingNote.short_description);
      setBody(editingNote.body || '');
      setKeywords(editingNote.keywords || []);
    } else {
      setHeader('');
      setShortDescription('');
      setBody('');
      setKeywords([]);
    }
    setKeywordsInput('');
  }, [editingNote, isOpen]);

  const handleAddKeyword = () => {
    const trimmed = keywordsInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordsInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!header.trim()) return;

    setSaving(true);
    try {
      await onSave({
        header: header.trim(),
        short_description: shortDescription.trim(),
        body: body.trim() || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <h2>{title}</h2>
      <form onSubmit={handleSubmit}>
      <div className={modalStyles.modalBody}>
        <div className={modalStyles.formGroup}>
          <label>Заголовок</label>
          <input
            type="text"
            className={inputStyles.input}
            value={header}
            onChange={e => setHeader(e.target.value)}
            placeholder="Введите заголовок заметки"
            required
            style={{ width: '100%' }}
          />
        </div>
        
        <div className={modalStyles.formGroup}>
          <label>Краткое описание</label>
          <input
            type="text"
            className={inputStyles.input}
            value={shortDescription}
            onChange={e => setShortDescription(e.target.value)}
            placeholder="Краткое описание заметки"
            style={{ width: '100%' }}
          />
        </div>
        
        <div className={modalStyles.formGroup}>
          <label>Текст заметки (Markdown)</label>
          <div data-color-mode={getEditorColorMode(themeConfig)}>
            <MDEditor
              value={body}
              onChange={(val) => setBody(val || '')}
              preview="edit"
              height={300}
            />
          </div>
        </div>
        
        <div className={modalStyles.formGroup}>
          <label>Ключевые слова</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              className={inputStyles.input}
              value={keywordsInput}
              onChange={e => setKeywordsInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите ключевое слово и нажмите Enter"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className={buttonStyles.button}
              onClick={handleAddKeyword}
            >
              Добавить
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {keywords.map((keyword, idx) => (
              <span
                key={idx}
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '1rem',
                    lineHeight: '1'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        
        </div>
        <div className={modalStyles.buttons}>
          <button
            type="button"
            className={buttonStyles.button}
            onClick={onClose}
            style={{ backgroundColor: 'var(--text-secondary)' }}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={buttonStyles.button}
            disabled={saving || !header.trim()}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
        </form>
    </ModalPortal>
  );
};

export default GroupNoteModal;
