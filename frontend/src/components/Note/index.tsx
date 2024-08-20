import React from "react";

import "./index.css";
import { useNotes } from "../../store/NoteContext";
import deleteIcon from "../../assets/carbon_delete.svg";
import editIcon from "../../assets/carbon_edit.svg";
import { IconButton } from "../IconButton";
import { Api, INote } from "../../utils/api";
import { useAuth } from "../../store/AuthContent";

// Функция для замены символов и декодирования HTML
const decodeHtml = (html: string | undefined) => {
  // Заменяем HTML-сущности на соответствующие символы
  if (html === undefined) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

interface MultiLineTextProps {
  text: string;
}

const MultiLineText: React.FC<MultiLineTextProps> = ({ text }) => {
  const lines = text.split("\n");

  return (
    <div>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {line}
          <br />
        </React.Fragment>
      ))}
    </div>
  );
};

export const Note = () => {
  const { activeNote, setNotes, notes } = useNotes();
  const { token } = useAuth();
  const formattedMessage = decodeHtml(activeNote?.body);

  const handleNoteEdit = (note: INote, token: string) => {
    Api.updateNote(note, token);
  };

  const handleNoteDelete = (note: INote, token: string) => {
    const isConfirmed = confirm("Вы уверены, что хотите удалить эту заметку?");
    if (isConfirmed && notes && setNotes) {
      Api.deleteNote(note, token);
      setNotes(notes.filter((n: INote) => n.id !== note.id));
    }
  };

  return (
    <div className="note">
      <div className="note-headerBox">
        <header className="note-headerTitle">{activeNote?.header}</header>
        <div className="note-headerActions">
          {activeNote && (
            <>
              <IconButton
                icon={editIcon}
                tooltip="Редактировать заметку"
                onClick={() =>
                  activeNote && token && handleNoteEdit(activeNote, token)
                }
              />
              <IconButton
                icon={deleteIcon}
                tooltip="Удалить заметку"
                onClick={() =>
                  activeNote && token && handleNoteDelete(activeNote, token)
                }
              />
            </>
          )}
        </div>
      </div>
      <div className="note-text">
        <MultiLineText text={formattedMessage} />
      </div>
      <div className="note-author">
        <img src={activeNote?.author.photo} />
        <p className="note-author-text">
          {activeNote?.author.first_name} {activeNote?.author.last_name}
        </p>
      </div>
    </div>
  );
};
