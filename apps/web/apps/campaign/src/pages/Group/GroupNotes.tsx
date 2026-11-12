import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GroupNote, CreateGroupNoteRequest } from '../../types/groupNotes';
import { groupNotesAPI } from '../../services/api';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import NoteCard from './Cards/NoteCard/NoteCard';
import GroupNoteModal from './Modals/NoteModal/GroupNoteModal';
import GroupNoteViewModal from './Modals/NoteModal/GroupNoteViewModal';
import List from '@tdn/shared/ui/List/List';
import SearchBar from '@tdn/shared/ui/Search/SearchBar';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import styles from '../../components/commons/Pages/ResourcePage/ResourcePage.module.css';
import { ThemeProvider } from '@tdn/shared/theme/ThemeContext';

const GroupNotes: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<GroupNote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingNoteData, setViewingNoteData] = useState<GroupNote | null>(null);
  const [, setViewLoading] = useState(false);
  const { canEditGroup } = useActionPermissions();

  useEffect(() => {
    if (groupId) {
      loadNotes();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotes = async () => {
    try {
      setLoading(true);
      const notesData = await groupNotesAPI.getNotes(parseInt(groupId!));
      setNotes(notesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter(note => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      note.header.toLowerCase().includes(term) ||
      note.short_description.toLowerCase().includes(term) ||
      note.keywords.some(k => k.toLowerCase().includes(term))
    );
  });

  const handleCreate = () => {
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleSaveNote = async (noteData: CreateGroupNoteRequest) => {
    if (editingNote) {
      await groupNotesAPI.updateNote(parseInt(groupId!), editingNote.id, noteData);
    } else {
      await groupNotesAPI.createNote(parseInt(groupId!), noteData);
    }
    setIsModalOpen(false);
    setEditingNote(null);
    loadNotes();
  };

  const handleClearSearch = () => setSearchTerm('');

  const handleViewNote = async (note: GroupNote) => {
    setViewModalOpen(true);
    setViewLoading(true);
    setViewingNoteData(null);
    try {
      const fullNote = await groupNotesAPI.getNote(parseInt(groupId!), note.id);
      setViewingNoteData({
        ...note,
        body: fullNote.body,
      });
    } catch (err) {
      console.error('Failed to load note body:', err);
    } finally {
      setViewLoading(false);
    }
  };

  if (loading) return <div className={commonStyles.container}>Загрузка...</div>;

  return (
    <ThemeProvider>
      <div className={commonStyles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Заметки</h1>
          <div className={styles.headerButtons}>
            {canEditGroup && (
              <button
                className={`${buttonStyles.button} ${styles.createButton}`}
                onClick={handleCreate}
                type="button"
              >
                <span className={styles.plusIcon}>+</span>
                <span className={styles.createText}>Создать</span>
              </button>
            )}
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}

        <div className={styles.headerControls}>
          <div className={styles.searchContainer}>
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Поиск по заголовку, описанию или ключевым словам..."
              onClear={handleClearSearch}
            />
          </div>
        </div>

        <List layout="start-grid" gap="medium" gridSize="large">
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onView={() => handleViewNote(note)}
            />
          ))}
        </List>

        {filteredNotes.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <p>
              {searchTerm
                ? `По запросу "${searchTerm}" ничего не найдено`
                : 'Нет заметок'}
            </p>
            {searchTerm && (
              <button
                className={buttonStyles.button}
                onClick={handleClearSearch}
                type="button"
              >
                Очистить поиск
              </button>
            )}
          </div>
        )}

        {canEditGroup && (
          <GroupNoteModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingNote(null);
            }}
            onSave={handleSaveNote}
            editingNote={editingNote}
            title={editingNote ? 'Редактирование заметки' : 'Создание заметки'}
          />
        )}

        {viewModalOpen && (
          <GroupNoteViewModal
            note={viewingNoteData}
            onClose={() => {
              setViewModalOpen(false);
              setViewingNoteData(null);
            }}
            onEdit={() => {
              setViewModalOpen(false);
              setViewingNoteData(null);
              if (viewingNoteData) {
                setEditingNote(viewingNoteData);
                setIsModalOpen(true);
              }
            }}
            onDelete={async () => {
              if (viewingNoteData && window.confirm('Вы уверены, что хотите удалить эту заметку?')) {
                try {
                  await groupNotesAPI.deleteNote(parseInt(groupId!), viewingNoteData.id);
                  setViewModalOpen(false);
                  setViewingNoteData(null);
                  loadNotes();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to delete note');
                }
              }
            }}
            canEdit={canEditGroup}
            canDelete={canEditGroup}
          />
        )}
      </div>
    </ThemeProvider>
  );
};

export default GroupNotes;
