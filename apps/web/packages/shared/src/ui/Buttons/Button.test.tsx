import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Button from './Button';
import LinkButton from './LinkButton';

describe('Button', () => {
  test('defaults to a native button type button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  test('supports submit type', () => {
    render(<Button type="submit">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'submit');
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
        <LinkButton to="/destination" target="_blank">Open</LinkButton>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Open' });
    expect(link).toHaveAttribute('href', '/destination');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('retains its ref', () => {
    const ref = React.createRef<HTMLAnchorElement>();
    render(
      <MemoryRouter>
        <LinkButton to="/destination" ref={ref}>Open</LinkButton>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Open' });
    expect(link).toHaveAttribute('href', '/destination');
    expect(ref.current).toBe(link);
  });
});
