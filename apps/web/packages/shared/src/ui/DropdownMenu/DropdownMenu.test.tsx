import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import DropdownMenu from './DropdownMenu';

const Location: React.FC = () => <output aria-label="Path">{useLocation().pathname}</output>;

describe('DropdownMenu', () => {
  test('preserves command buttons and accessible disclosure behavior', () => {
    const onClick = vi.fn();
    render(<DropdownMenu items={[{ label: 'Run command', onClick }]} buttonTitle="Actions" />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const command = screen.getByRole('button', { name: 'Run command' });
    expect(command).toHaveAttribute('type', 'button');
    fireEvent.click(command);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Run command' })).not.toBeInTheDocument();
  });

  test('closes on Escape and returns focus to the trigger', () => {
    render(<DropdownMenu items={[{ label: 'Run command' }]} buttonTitle="Actions" />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Run command' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  test('closes on outside click', () => {
    render(<DropdownMenu items={[{ label: 'Run command' }]} buttonTitle="Actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('button', { name: 'Run command' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'Run command' })).not.toBeInTheDocument();
  });

  test('renders route items as links and preserves modifier clicks', () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter initialEntries={['/start']}>
        <DropdownMenu items={[{ label: 'Destination', to: '/destination', active: true, onClick }]} buttonTitle="Navigate" />
        <Location />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    const link = screen.getByRole('link', { name: 'Destination' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/destination');
    expect(link).toHaveAttribute('aria-current', 'page');
    const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    fireEvent(link, modifiedClick);
    expect(modifiedClick.defaultPrevented).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Path')).toHaveTextContent('/start');
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    fireEvent.click(screen.getByRole('link', { name: 'Destination' }));
    expect(screen.getByLabelText('Path')).toHaveTextContent('/destination');
    expect(screen.queryByRole('link', { name: 'Destination' })).not.toBeInTheDocument();
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test('closes when focus moves outside the disclosure', () => {
    render(<><DropdownMenu items={[{ label: 'Run command' }]} buttonTitle="Actions" /><button>Outside</button></>);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const trigger = screen.getByRole('button', { name: 'Actions' });
    fireEvent.blur(trigger, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(screen.queryByRole('button', { name: 'Run command' })).not.toBeInTheDocument();
  });
});
