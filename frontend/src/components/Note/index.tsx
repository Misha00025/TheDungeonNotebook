import { useNavigate, useOutletContext } from "react-router-dom";
import { TGroupContentContext } from "../../router/layouts/GroupContentLayout";
import { useAuth } from "../../store/AuthContent";
import { NoteService } from "../../utils/api/noteService";
import { DetailContent } from "../DetailContent";
import { Avatar, CircularProgress } from "@mui/material";
import "./index.css";

/**
 * Component for displaying and editing a note
 */
export const Note = () => {
  const { token } = useAuth();
  const { notesContext } = useOutletContext<TGroupContentContext>();
  const navigate = useNavigate();

  const activeNote = notesContext.activeNote;

  const handleNoteSave = async (body: string, header: string) => {
    try {
      if (!activeNote) return;

      const updatedNote = await NoteService.updateNote({
        ...activeNote,
        header,
        body,
      });

      // Update local state
      notesContext.setNotes([
        ...notesContext.notes.map((note) =>
          note.id === activeNote.id ? updatedNote : note,
        ),
      ]);
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };

  const handleNoteDelete = async () => {
    try {
      if (!activeNote) return;

      await NoteService.deleteNote(activeNote.id);

      // Update local state
      notesContext.setNotes(
        notesContext.notes.filter((note) => note.id !== activeNote.id),
      );

      // Navigate back
      navigate("../");
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  if (!activeNote) {
    return <CircularProgress />;
  }

  const NoteFooter = (
    <div className="note-author">
      <Avatar src={activeNote.author.photo} />
      <p className="note-author-text">
        {activeNote.author.first_name} {activeNote.author.last_name}
      </p>
    </div>
  );

  return (
    <DetailContent
      title={activeNote.header}
      content={activeNote.body}
      footer={NoteFooter}
      onSave={handleNoteSave}
      onDelete={handleNoteDelete}
      isLoading={false}
    />
  );
};
