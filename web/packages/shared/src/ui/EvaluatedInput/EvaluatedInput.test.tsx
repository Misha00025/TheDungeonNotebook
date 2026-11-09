import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvaluatedInput from './EvaluatedInput';

describe('EvaluatedInput', () => {
  it('renders with initial value', () => {
    render(<EvaluatedInput initialValue="42" onCommit={() => {}} />);
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('updates when initialValue prop changes', () => {
    const { rerender } = render(<EvaluatedInput initialValue="1" onCommit={() => {}} />);
    rerender(<EvaluatedInput initialValue="2" onCommit={() => {}} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('calls onCommit with computed expression on Enter', async () => {
    const onCommit = vi.fn();
    render(<EvaluatedInput initialValue="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, '2 + 3{Enter}');

    expect(onCommit).toHaveBeenCalledWith('5');
  });

  it('calls onCommit with raw text on Enter if expression is invalid', async () => {
    const onCommit = vi.fn();
    render(<EvaluatedInput initialValue="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'hello{Enter}');

    expect(onCommit).toHaveBeenCalledWith('hello');
  });

  it('calls onCommit on blur', () => {
    const onCommit = vi.fn();
    render(<EvaluatedInput initialValue="10" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith('10');
  });

  it('calls onCancel and resets value on Escape', async () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    render(<EvaluatedInput initialValue="initial" onCommit={onCommit} onCancel={onCancel} />);
    const input = screen.getByRole('textbox');

    await userEvent.clear(input);
    await userEvent.type(input, 'changed{Escape}');

    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('passes extra props to the input element', () => {
    render(
      <EvaluatedInput
        initialValue=""
        onCommit={() => {}}
        placeholder="Enter value"
        required
        disabled
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter value');
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
  });
});
