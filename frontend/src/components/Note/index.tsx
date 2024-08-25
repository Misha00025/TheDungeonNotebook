import React, { ChangeEvent, useEffect, useState } from "react";
import { IconButton } from "../IconButton";
import { Api, INote } from "../../utils/api";
import { useAuth } from "../../store/AuthContent";

import { useNotes } from "../../store/NoteContext";
import { useNavigate } from "react-router-dom";

import deleteIcon from "../../assets/carbon_trash-can.svg";
import editIcon from "../../assets/carbon_edit.svg";
import unsavedIcon from "../../assets/carbon_unsaved.svg";
import saveIcon from "../../assets/carbon_save.svg";

import "./index.css";

interface MultiLineTextProps {
  text?: string;
  isEditMode?: boolean;
  onChange: (value: ChangeEvent<HTMLTextAreaElement>) => void;
}

const MultiLineText: React.FC<MultiLineTextProps> = ({
  text,
  isEditMode = false,
  onChange,
}) => {
  return (
    <textarea
      className={`note-multiLineText ${isEditMode ? "note-multiLineText__editing" : "note-multiLineText__readOnly"}`}
      spellCheck="true"
      name="noteText"
      value={text}
      onChange={onChange}
      readOnly={!isEditMode}
    />
  );
};

export const Note = () => {
  const { token } = useAuth();
  const { activeNote, setNotes, notes } = useNotes();
  const navigate = useNavigate();

  const [isEditMode, setIsEditMode] = useState(false);
  const [activeNoteText, setActiveNoteText] = useState(activeNote?.body);
  const [activeNoteHeader, setActiveNoteHeader] = useState(activeNote?.header);

  useEffect(() => {
    setActiveNoteText(activeNote?.body);
    setActiveNoteHeader(activeNote?.header);
  }, [activeNote]);

  const handleNoteEdit = () => {
    setIsEditMode((lastEditMode) => !lastEditMode);
  };

  const handleNoteDelete = () => {
    const isConfirmed = confirm("Вы уверены, что хотите удалить эту заметку?");
    if (isConfirmed && notes && setNotes && activeNote) {
      Api.deleteNote(activeNote.id, token);
      setNotes(notes.filter((n: INote) => n.id !== activeNote.id));
      navigate("..");
    }
  };

  const handleChangeNoteText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setActiveNoteText(event.target.value);
  };

  const handleChangeNoteTitle = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setActiveNoteHeader(event.target.value);
  };

  const handleNoteEditSave = async () => {
    if (activeNote && setNotes && notes) {
      const changedNote = {
        ...activeNote,
        body: activeNoteText ?? activeNote.body,
        header: activeNoteHeader ?? activeNote.header,
      };

      await Api.updateNote(changedNote, token);

      setNotes([
        ...notes.map((n: INote) => (n.id !== activeNote.id ? n : changedNote)),
      ]);
    }
    setIsEditMode(false);
  };

  const handleNoteEditCancel = () => {
    setActiveNoteText(activeNote?.body);
    setIsEditMode(false);
  };

  return (
    <div className="note">
      <div className="note-headerBox">
        <header className="note-headerTitle">
          <MultiLineText
            onChange={handleChangeNoteTitle}
            text={activeNoteHeader}
            isEditMode={isEditMode}
          />
        </header>
        <div className="note-headerActions">
          {activeNote && (
            <>
              <IconButton
                icon={editIcon}
                tooltip="Редактировать заметку"
                onClick={() => activeNote && handleNoteEdit()}
              />
              <IconButton
                icon={deleteIcon}
                tooltip="Удалить заметку"
                onClick={() => activeNote && handleNoteDelete()}
              />
            </>
          )}
        </div>
      </div>
      <div className="note-body">
        <MultiLineText
          text={activeNoteText}
          isEditMode={isEditMode}
          onChange={handleChangeNoteText}
        />
        {isEditMode && (
          <div className="note-editModeButtons">
            <IconButton
              text="Отменить"
              onClick={handleNoteEditCancel}
              icon={unsavedIcon}
              color="red"
            />
            <IconButton
              text="Сохранить"
              onClick={handleNoteEditSave}
              icon={saveIcon}
              color="green"
            />
          </div>
        )}
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
