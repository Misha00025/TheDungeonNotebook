import React, { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModalPortal from './ModalPortal';

const dialogPrototype = HTMLDialogElement.prototype;
const originalShowModal = Object.getOwnPropertyDescriptor(dialogPrototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(dialogPrototype, 'close');
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open');
});

const restoreDescriptor = (name: 'showModal' | 'close', descriptor?: PropertyDescriptor) => {
  if (descriptor) Object.defineProperty(dialogPrototype, name, descriptor);
  else Reflect.deleteProperty(dialogPrototype, name);
};

beforeEach(() => {
  showModal.mockClear();
  close.mockClear();
  Object.defineProperty(dialogPrototype, 'showModal', { configurable: true, value: showModal });
  Object.defineProperty(dialogPrototype, 'close', { configurable: true, value: close });
});

afterEach(() => {
  cleanup();
  restoreDescriptor('showModal', originalShowModal);
  restoreDescriptor('close', originalClose);
});

describe('ModalPortal native dialog', () => {
  it('opens a named dialog with showModal', () => {
    render(<ModalPortal isOpen onClose={vi.fn()} title="Create item">Dialog content</ModalPortal>);
    const dialog = screen.getByRole('dialog', { name: 'Create item' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('does not mount a closed dialog and closes it during unmount', () => {
    const onClose = vi.fn();
    const view = render(<ModalPortal isOpen onClose={onClose} title="Create item">Content</ModalPortal>);
    expect(showModal).toHaveBeenCalledTimes(1);
    view.rerender(<ModalPortal isOpen={false} onClose={onClose} title="Create item">Content</ModalPortal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('routes cancel through the current callback and remains open when the parent rejects closing', () => {
    const onClose = vi.fn();
    render(<ModalPortal isOpen onClose={onClose} title="Create item">Content</ModalPortal>);
    const dialog = screen.getByRole('dialog', { name: 'Create item' });
    const event = new Event('cancel', { cancelable: true });
    fireEvent(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('open');
  });

  it('blocks close button, cancel, and backdrop dismissal when dismissDisabled', () => {
    const onClose = vi.fn();
    render(<ModalPortal isOpen onClose={onClose} title="Create item" dismissDisabled>Content</ModalPortal>);
    const dialog = screen.getByRole('dialog', { name: 'Create item' });
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute('open');
  });

  it('restores focus to the connected opener when unmounted', () => {
    const view = render(<><button type="button">Open</button><ModalPortal isOpen={false} onClose={vi.fn()} title="Create item">Content</ModalPortal></>);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    view.rerender(<><button type="button">Open</button><ModalPortal isOpen onClose={vi.fn()} title="Create item"><input autoFocus aria-label="Initial focus" /></ModalPortal></>);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Initial focus' }));
    view.rerender(<><button type="button">Open</button><ModalPortal isOpen={false} onClose={vi.fn()} title="Create item">Content</ModalPortal></>);
    expect(document.activeElement).toBe(opener);
  });

  it('keeps child state mounted across callback changes and a rejected close request', () => {
    const Draft = () => {
      const [value, setValue] = useState('');
      return <input aria-label="Draft" value={value} onChange={event => setValue(event.target.value)} />;
    };
    const firstClose = vi.fn();
    const nextClose = vi.fn();
    const view = render(<ModalPortal isOpen onClose={firstClose} title="Create item"><Draft /></ModalPortal>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'Unsaved' } });
    view.rerender(<ModalPortal isOpen onClose={nextClose} title="Create item"><Draft /></ModalPortal>);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(nextClose).toHaveBeenCalledTimes(1);
    expect(firstClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Unsaved');
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('preserves the legacy portal contract without a title', () => {
    const onClose = vi.fn();
    render(<ModalPortal isOpen onClose={onClose}>Legacy content</ModalPortal>);
    const content = screen.getByText('Legacy content');
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(content.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(showModal).not.toHaveBeenCalled();
  });
});
