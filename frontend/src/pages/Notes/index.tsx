import { Outlet, useParams } from 'react-router-dom';
import { ItemSelectorBox } from '../../components/ItemSelectorBox'

const mockListItems = () => {
    const items = [];
    for (let i = 0; i < 4; i++) {
        items.push(
            {
                name: `Мои характеристики  характериристики${i}`,
                id: i
            }
        )
    }

    return Promise.resolve(items);
}

export const Notes = () => {
    const { noteId } = useParams();
    console.log("noteId" + noteId)
    return (
        <ItemSelectorBox
            headerText='Заметки'
            linkPrefix='notes/'
            initialItemsCallback={() => mockListItems()}
            initialActiveItemId={noteId ? Number(noteId) : undefined }
        />
    );
}
