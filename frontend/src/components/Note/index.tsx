import { useNavigate, useOutletContext } from "react-router-dom";
import { TGroupContentContext } from "../../router/layouts/GroupContentLayout";
import { useAuth } from "../../store/AuthContent";
import { Api } from "../../utils/api";
import { ItemContent } from "../ItemContent";

import "./index.css";
import { Avatar } from "@mui/material";

export const Note = () => {
  const { token } = useAuth();
  const { notesContext } = useOutletContext<TGroupContentContext>();
  const navigate = useNavigate();

  const activeNote = notesContext.activeNote;

  const handleNoteSave = (body: string, header: string) => {
    Api.updateNote(
      {
        ...activeNote,
        header: header,
        body: body,
      },
      token,
    );
  };

  const handleNoteDelete = () => {
    Api.deleteNote(activeNote?.id, token);
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
    return <>Active note is not defined!</>;
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
