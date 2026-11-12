import React, { useState } from 'react';
import { GroupNote } from '../../../../types/groupNotes';

interface NoteCardProps {
  note: GroupNote;
  onView?: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onView }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onView}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? 'var(--bg-primary)' : 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-md)',
        marginBottom: '1rem',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
    >
      <div style={{ padding: '0.75rem 0.75rem 0 0.75rem' }}>
        <h3 style={{
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: 'var(--text-primary)',
          fontSize: '1rem',
        }} title={note.header}>
          {note.header}
        </h3>
      </div>

      {note.keywords && note.keywords.length > 0 && (
        <div style={{ padding: '0.5rem 0.75rem 0.25rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {note.keywords.map((keyword, idx) => (
            <span key={idx} style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              padding: '0.15rem 0.4rem',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.75rem',
              border: '1px solid var(--accent-color)',
            }}>
              {keyword}
            </span>
          ))}
        </div>
      )}

      {note.short_description && (
        <div style={{ padding: '0.25rem 0.75rem 0.75rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {note.short_description}
        </div>
      )}
    </div>
  );
};

export default NoteCard;
