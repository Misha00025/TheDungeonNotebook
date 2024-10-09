import { useNavigate, useOutletContext } from "react-router-dom";
import { TGroupContentContext } from "../../router/layouts/GroupContentLayout";
import { useAuth } from "../../store/AuthContent";
import { Api } from "../../utils/api";
import { ItemContent } from "../ItemContent";

import "./index.css";
import { Avatar, CircularProgress } from "@mui/material";

export const Note = () => {
  const { token } = useAuth();
  const { notesContext } = useOutletContext<TGroupContentContext>();
  const navigate = useNavigate();

  const activeNote = notesContext.activeNote;

  const handleNoteSave = async (body: string, header: string) => {
    await Api.updateNote(
      {
        ...activeNote,
        header: header,
        body: body,
      },
      token,
    );

    notesContext.setNotes([
      ...notesContext.notes.map((note) =>
        note.id === activeNote.id ? { ...note, header, body } : note,
      ),
    ]);
  };

  const handleNoteDelete = async () => {
    await Api.deleteNote(activeNote?.id, token);

    notesContext.notes = notesContext.notes.filter(
      (note) => note.id !== activeNote.id,
    );
    navigate("../");
  };

  const ItemFooter = (
    <>
      <div className="note-author">
        <Avatar src={notesContext.activeNote?.author.photo} />
        <p className="note-author-text">
          {notesContext.activeNote?.author.first_name}{" "}
          {notesContext.activeNote?.author.last_name}
        </p>
      </div>
    </>
  );

  if (!activeNote) {
    return <CircularProgress />;
  }

  return (
    <ItemContent
      itemBodyText={activeNote?.body}
      itemHeaderText={activeNote?.header}
      itemFooter={ItemFooter}
      handleItemSave={handleNoteSave}
      handleItemDelete={handleNoteDelete}
    />
  );
};
