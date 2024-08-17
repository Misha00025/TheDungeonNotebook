import React from "react";

import "./index.css";
import { INote } from "../../utils/api";
import { useNotes } from "../../store/NoteContext";

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
        <>
          {line}
          <br />
        </>
      ))}
    </div>
  );
};

export const Note = () => {
  const { activeNote } = useNotes();
  const formattedMessage = decodeHtml(activeNote?.body);
  return (
    <div className="note">
      <header className="note-header">{activeNote?.header}</header>
      <p className="note-text">
        <MultiLineText text={formattedMessage} />
      </p>
      <div className="note-author">
        <img src={activeNote?.author.photo} />
        <p className="note-author-text">
          {activeNote?.author.first_name} {activeNote?.author.last_name}
        </p>
      </div>
    </div>
  );
};
