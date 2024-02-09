import { Outlet, useParams } from 'react-router-dom';
import { ItemSelectorBox } from '../../components/ItemSelectorBox'
import { Notes } from '../../pages/Notes';

export const NotesLayout = () => {
    const { noteId } = useParams();
    console.log("noteId" + noteId);
    return (
        <>
            <Notes />
            <Outlet />
        </>
    );
}
