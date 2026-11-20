import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import InlineValueEditor from './InlineValueEditor';

const makeChildren = () => <><input aria-label="Value" defaultValue="initial" /><button type="button">Choice</button></>;

describe('InlineValueEditor', () => {
  it('shows only display until clicked, focuses the first input, and commits once on outside blur', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<><InlineValueEditor display={<span>42</span>} label="Score" disabled={false} onCommit={onCommit}>{makeChildren()}</InlineValueEditor><button type="button">Outside</button></>);
    expect(screen.queryByRole('textbox', { name: 'Value' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const display = screen.getByRole('button', { name: 'Изменить показатель Score' });
    fireEvent.focus(display);
    fireEvent.blur(display, { relatedTarget: document.body });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(display);
    const input = screen.getByRole('textbox', { name: 'Value' });
    expect(input).toHaveFocus();
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(screen.getByRole('button', { name: 'Изменить показатель Score' })).toHaveTextContent('42');
    expect(onCommit).toHaveBeenCalledTimes(1);
    unmount();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('commits once on Enter followed by blur and closes Escape without committing', () => {
    const onCommit = vi.fn();
    render(<InlineValueEditor display="value" label="Score" disabled={false} onCommit={onCommit}>{makeChildren()}</InlineValueEditor>);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Score' }));
    const input = screen.getByRole('textbox', { name: 'Value' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Score' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Value' }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Изменить показатель Score' })).toBeInTheDocument();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('does not open or commit when disabled', () => {
    const onCommit = vi.fn();
    render(<InlineValueEditor display="value" label="Score" disabled onCommit={onCommit}>{makeChildren()}</InlineValueEditor>);
    const display = screen.getByRole('button', { name: 'Изменить показатель Score' });
    expect(display).toBeDisabled();
    fireEvent.click(display);
    expect(screen.queryByRole('textbox', { name: 'Value' })).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps editing while focus moves among contained controls and ignores textarea Enter and IME Enter', () => {
    const onCommit = vi.fn();
    render(<InlineValueEditor display="value" label="Options" disabled={false} onCommit={onCommit}><fieldset><input type="checkbox" aria-label="First choice" /><input type="checkbox" aria-label="Second choice" /></fieldset><textarea aria-label="Notes" /></InlineValueEditor>);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Options' }));
    const first = screen.getByRole('checkbox', { name: 'First choice' });
    const second = screen.getByRole('checkbox', { name: 'Second choice' });
    fireEvent.blur(first, { relatedTarget: second });
    expect(second).toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.keyDown(second, { key: 'Enter', isComposing: true });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(textarea, { relatedTarget: document.body });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Изменить показатель Options' })).toBeInTheDocument();
  });

  it('keeps its edit session across parent rerenders until blur', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<InlineValueEditor display="first" label="Score" disabled={false} onCommit={onCommit}>{makeChildren()}</InlineValueEditor>);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить показатель Score' }));
    rerender(<InlineValueEditor display="updated" label="Score" disabled={false} onCommit={onCommit}>{makeChildren()}</InlineValueEditor>);
    expect(screen.getByRole('textbox', { name: 'Value' })).toBeInTheDocument();
    fireEvent.blur(screen.getByRole('textbox', { name: 'Value' }), { relatedTarget: document.body });
    expect(screen.getByRole('button', { name: 'Изменить показатель Score' })).toHaveTextContent('updated');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
