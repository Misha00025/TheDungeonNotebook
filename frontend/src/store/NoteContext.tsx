import React, { ReactNode, createContext, useCallback, useContext, useState } from 'react';

import { INote } from '../utils/api';

interface NotesProviderProps {
    children: ReactNode
}

interface NoteCreateContext {
    activeNote: INote | undefined;
    notes: Array<INote> | undefined;
    setActiveNoteById: ((noteId: number) => void) | undefined;
    setNotes: React.Dispatch<React.SetStateAction<INote[] | undefined>> | undefined;
}

const NoteContext = createContext<NoteCreateContext>({
    activeNote: undefined,
    notes: [],
    setActiveNoteById: undefined,
    setNotes: undefined
});

export const useNotes = () => useContext(NoteContext);

export const NotesProvider: React.FC<NotesProviderProps> = ({ children }) => {
    const [activeNote, setActiveNote] = useState<INote>();
    const [notes, setNotes] = useState<Array<INote>>();

    const setActiveNoteById = (noteId: number) => {
        if (notes) {
            setActiveNote(notes.find(note => note.id === noteId));
        }
    }

    return <NoteContext.Provider value={{ activeNote, setActiveNoteById, notes, setNotes }}>{children}</NoteContext.Provider>;
};
