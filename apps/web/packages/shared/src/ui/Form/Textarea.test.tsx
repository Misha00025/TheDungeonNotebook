import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import Textarea from './Textarea';

describe('Textarea', () => {
  it('forwards its ref and native value and disabled attributes', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Notes" defaultValue="Draft" disabled />);
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(ref.current).toBe(textarea);
    expect(textarea).toHaveValue('Draft');
    expect(textarea).toBeDisabled();
  });
});
