import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Button from './Button';
import LinkButton from './LinkButton';

describe('Button', () => {
  test('defaults to a primary button type button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  test('supports submit and secondary variant', () => {
    render(<Button type="submit" variant="secondary">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button.className).toContain('secondary');
  });

  test('busy disables the button and preserves children', () => {
    render(<Button busy>Saving</Button>);
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  test('disabled button does not invoke click handler', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('LinkButton', () => {
  test('renders a router anchor with native navigation attributes', () => {
    render(
      <MemoryRouter>
        <LinkButton to="/destination" target="_blank" variant="secondary">Open</LinkButton>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Open' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/destination');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.className).toContain('secondary');
  });
});
