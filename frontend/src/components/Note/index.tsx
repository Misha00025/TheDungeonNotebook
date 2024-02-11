import React from 'react'

import './index.css'
import { INote } from '../../utils/api';
import { useNotes } from '../../store/NoteContext';


export const Note = () => {
    const { activeNote } = useNotes();
  return (
    <div className='note'>
        <header className='note-header'>
            {activeNote?.header}
        </header>
        <p className='note-text'>
            {activeNote?.body}
        </p>
        <div className='note-author'>
            <img src={activeNote?.author.photo}/><p className='note-author-text'>{activeNote?.author.first_name} {activeNote?.author.last_name}</p>
        </div>
    </div>
  )
}
