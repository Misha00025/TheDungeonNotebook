import { Outlet, useParams } from "react-router-dom";
import { ItemSelectorBox } from "../../components/ItemSelectorBox";
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
