import { Outlet } from "react-router-dom";
import { Notes } from "../../pages/Notes";
import { NotesProvider } from "../../store/NoteContext";

export const NotesLayout = () => {
  return (
    <>
      <NotesProvider>
        <Notes />
        <Outlet />
      </NotesProvider>
    </>
  );
};
