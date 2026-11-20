import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FileInput from './FileInput';

describe('FileInput', () => {
  test('opens the native input and forwards its selected file', () => {
    const ref = createRef<HTMLInputElement>();
    const selectedFile = vi.fn<(file: File | undefined) => void>();
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      selectedFile(event.currentTarget.files?.[0]);
    });
    render(<FileInput ref={ref} id="upload" accept=".json" onChange={onChange} />);

    const input = ref.current;
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('id', 'upload');
    expect(input).toHaveAttribute('accept', '.json');
    const nativeClick = vi.spyOn(input!, 'click');

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать файл' }));
    expect(nativeClick).toHaveBeenCalled();

    const file = new File(['{}'], 'export.json', { type: 'application/json' });
    fireEvent.change(input!, { target: { files: [file] } });
    expect(onChange).toHaveBeenCalled();
    expect(selectedFile).toHaveBeenCalledWith(file);

    input!.value = '';
    expect(input!.value).toBe('');
  });

  test('disabled prevents choosing a file', () => {
    let input: HTMLInputElement | null = null;
    render(<FileInput disabled ref={element => { input = element; }} />);

    const nativeClick = vi.spyOn(input!, 'click');
    const button = screen.getByRole('button', { name: 'Выбрать файл' });
    expect(input).toBeDisabled();
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(nativeClick).not.toHaveBeenCalled();
  });
});
