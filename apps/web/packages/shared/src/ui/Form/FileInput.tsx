import React, { forwardRef, useRef } from 'react';
import type { InputProps } from './Input';
import Button from '../Buttons/Button';

export type FileInputProps = Omit<InputProps, 'type' | 'children' | 'hidden'> & {
  buttonLabel?: string;
};

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { buttonLabel = 'Выбрать файл', disabled, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...inputProps },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  };

  return <>
    <Button
      type="button"
      disabled={disabled}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
    >
      {buttonLabel}
    </Button>
    <input {...inputProps} ref={setInputRef} type="file" hidden disabled={disabled} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} />
  </>;
});

export default FileInput;
