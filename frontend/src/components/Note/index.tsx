import React from 'react'

import './index.css'

interface NoteProps {
    headerText: string;
    text: string;
    author: any;
}

export const Note = ({
    headerText,
    text,
    author
}: NoteProps) => {

  return (
    <div className='note'>
        <header className='note-header'>
            {headerText}
        </header>
        <p className='note-text'>
            {text}
        </p>
        <p className='note-footer'>{author}</p>
    </div>
  )
}
