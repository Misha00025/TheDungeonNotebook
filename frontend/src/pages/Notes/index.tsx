import { Outlet, useParams } from 'react-router-dom';
import { ItemSelectorBox } from '../../components/ItemSelectorBox'
import { useNotes } from '../../store/NoteContext';
import { useAuth } from '../../store/AuthContent';
import { Api } from '../../utils/api';
import { useCallback, useEffect, useMemo } from 'react';
import { usePlatform } from '../../store/PlatformContext';

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

export const Notes: React.FC = () => {
    const { noteId, groupId } = useParams();
    const { setActiveNoteById, setNotes, notes } = useNotes(); 
    const { token } = useAuth();
    const { platform } = usePlatform();

    useEffect(() => {
        setActiveNoteById && setActiveNoteById(Number(noteId));
    }, [noteId, notes]);

    const fetchNotes = useCallback(async () => {
        if (groupId && setNotes) {
            return Api.fetchNotes(Number(groupId), token).then((notes) => {
                setNotes(notes);
                return notes.map(note => ({id: note.id, name: note.header}));
            });
        } else {
            throw new Error('Error while setting initialItemsCallback for notes');
        }
    }, [groupId]);


    const handleActiveItemChanged = (id: number) => {
        if (setActiveNoteById) {
            setActiveNoteById(id);
        }
    }


    return (
        <ItemSelectorBox
            headerText='Заметки'
            linkPrefix='notes/'
            initialItemsCallback={fetchNotes}
            handleActiveItemChanged={handleActiveItemChanged}
            activeItemId={noteId ? Number(noteId) : undefined}
            refetchItemsOnChangeValue={groupId}
            isHided={noteId && platform === 'touch' ? true : false}
        />
    );
}
