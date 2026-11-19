import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Notification from './Notification';
import styles from './Notification.module.css';

describe('Notification', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.querySelectorAll('dialog[data-notification-test-dialog]').forEach(node => node.remove());
  });

  it('renders variants into shared stack outside source with roles, classes, and headings', () => {
    const source = document.createElement('main');
    document.body.appendChild(source);
    render(<><Notification kind="success">S</Notification><Notification kind="error">E</Notification><Notification kind="warning">W</Notification><Notification kind="info">I</Notification></>, { container: source });
    expect(source).toBeEmptyDOMElement();
    const root = document.querySelector('[data-tdn-notifications]');
    expect(root).toHaveAttribute('role', 'region');
    expect(root).toHaveAttribute('aria-label', 'Уведомления');
    expect(root?.children).toHaveLength(4);
    for (const [message, role, heading, className] of [
      ['S', 'status', 'Успех', styles.success], ['E', 'alert', 'Ошибка', styles.error],
      ['W', 'alert', 'Предупреждение', styles.warning], ['I', 'status', 'Информация', styles.info],
    ]) {
      const body = screen.getByText(message);
      expect(body.parentElement).toHaveClass(className);
      expect(body.parentElement).toHaveAttribute('role', role);
      expect(body.parentElement).toHaveTextContent(heading);
    }
    expect(screen.getAllByLabelText('Время до закрытия уведомления')).toHaveLength(4);
  });

  it('cleans root after timeout and manual close without requiring unmount', () => {
    const { rerender } = render(<Notification durationMs={1000}>Expires</Notification>);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Expires')).toBeNull();
    expect(document.querySelector('[data-tdn-notifications]')).toBeNull();
    rerender(<Notification eventKey="manual" durationMs={1000}>Manual</Notification>);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(screen.queryByText('Manual')).toBeNull();
    expect(document.querySelector('[data-tdn-notifications]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps stable events on rerender and does not reopen a closed event', () => {
    const onClose = vi.fn();
    const view = render(<Notification eventKey="fixed" durationMs={1000}>Stable</Notification>);
    act(() => vi.advanceTimersByTime(400));
    view.rerender(<Notification eventKey="fixed" durationMs={1000}>Stable</Notification>);
    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByText('Stable')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Stable')).toBeNull();
    view.rerender(<Notification eventKey="fixed" durationMs={1000}>Stable</Notification>);
    expect(screen.queryByText('Stable')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restarts full duration for a new object event key', () => {
    const view = render(<Notification eventKey={new Error('one')} durationMs={1000}>Failure</Notification>);
    act(() => vi.advanceTimersByTime(600));
    view.rerender(<Notification eventKey={new Error('two')} durationMs={1000}>Failure</Notification>);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText('Failure')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Failure')).toBeNull();
  });

  it('commits changed message and kind with a stable event key as one event', async () => {
    const view = render(<Notification kind="warning" eventKey="same" durationMs={1000}>Pending</Notification>);
    act(() => vi.advanceTimersByTime(400));
    view.rerender(<Notification kind="info" eventKey="same" durationMs={1000}>Exists</Notification>);
    const committedMessage = screen.getByText('Exists');
    expect(committedMessage.isConnected).toBe(true);
    expect(committedMessage.parentElement).toHaveAttribute('role', 'status');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Exists')).toBe(committedMessage);
    expect(committedMessage.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText('Exists')).toBe(committedMessage);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Exists')).toBeNull();
  });

  it('commits new text with an explicit new event key without detaching its committed node', async () => {
    const view = render(<Notification kind="warning" eventKey="before" durationMs={1000}>Before</Notification>);
    act(() => vi.advanceTimersByTime(400));
    view.rerender(<Notification kind="warning" eventKey="after" durationMs={1000}>After</Notification>);
    const committedMessage = screen.getByText('After');
    expect(committedMessage.isConnected).toBe(true);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('After')).toBe(committedMessage);
    expect(committedMessage.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText('After')).toBe(committedMessage);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('After')).toBeNull();
  });

  it('pauses and resumes hover time with exact remainder', () => {
    render(<Notification durationMs={1000}>Hover</Notification>);
    const card = screen.getByRole('status');
    act(() => vi.advanceTimersByTime(400));
    fireEvent.mouseEnter(card);
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByText('Hover')).toBeInTheDocument();
    fireEvent.mouseLeave(card);
    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByText('Hover')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Hover')).toBeNull();
  });

  it('restarts the default key when a string child changes', () => {
    const view = render(<Notification durationMs={1000}>First</Notification>);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('First')).toBeNull();
    view.rerender(<Notification durationMs={1000}>Second</Notification>);
    expect(screen.getByText('Second')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText('Second')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('keeps focus pause independent from hover and resumes only after blur outside', () => {
    render(<Notification durationMs={1000}><><button>Inside</button><button>Also inside</button></></Notification>);
    const card = screen.getByRole('status');
    const inside = screen.getByRole('button', { name: 'Inside' });
    const other = screen.getByRole('button', { name: 'Also inside' });
    const close = screen.getByRole('button', { name: 'Закрыть уведомление' });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.focus(inside);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    fireEvent.blur(inside, { relatedTarget: other });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText('Inside')).toBeInTheDocument();
    fireEvent.blur(other, { relatedTarget: close });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Inside')).toBeInTheDocument();
    fireEvent.blur(close, { relatedTarget: document.body });
    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByText('Inside')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Inside')).toBeNull();
  });

  it('reuses an existing shared root', () => {
    const root = document.createElement('div');
    root.dataset.tdnNotifications = '';
    document.body.appendChild(root);
    const view = render(<Notification durationMs={1000}>One</Notification>);
    expect(document.querySelectorAll('[data-tdn-notifications]')).toHaveLength(1);
    expect(document.querySelector('[data-tdn-notifications]')).toBe(root);
    expect(root.children).toHaveLength(1);
    view.unmount();
    expect(document.querySelector('[data-tdn-notifications]')).toBeNull();
  });

  it('keeps one notification and timer through StrictMode replay and cleans them on unmount', () => {
    const view = render(<StrictMode><Notification durationMs={1000}>One</Notification></StrictMode>);
    const currentRoot = document.querySelector('[data-tdn-notifications]');
    expect(document.querySelectorAll('[data-tdn-notifications]')).toHaveLength(1);
    expect(currentRoot?.children).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector('[data-tdn-notifications]')).toBeNull();
  });

  it('moves root into and out of the topmost open native dialog', async () => {
    const dialog = document.createElement('dialog');
    dialog.dataset.notificationTestDialog = '';
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    const view = render(<Notification durationMs={1000}>In dialog</Notification>);
    const root = document.querySelector('[data-tdn-notifications]');
    expect(root?.parentElement).toBe(dialog);
    act(() => vi.advanceTimersByTime(300));
    dialog.removeAttribute('open');
    await act(async () => { await Promise.resolve(); });
    expect(root?.parentElement).toBe(document.body);
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByText('In dialog')).toBeNull();
    view.unmount();
  });

  it('follows dialogs opened and closed after notification mount without resetting deadline', async () => {
    const view = render(<Notification durationMs={1000}>Follow dialog</Notification>);
    const root = document.querySelector('[data-tdn-notifications]');
    act(() => vi.advanceTimersByTime(300));
    const dialog = document.createElement('dialog');
    dialog.dataset.notificationTestDialog = '';
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    await act(async () => { await Promise.resolve(); });
    expect(root?.parentElement).toBe(dialog);
    act(() => vi.advanceTimersByTime(300));
    dialog.removeAttribute('open');
    await act(async () => { await Promise.resolve(); });
    expect(root?.parentElement).toBe(document.body);
    act(() => vi.advanceTimersByTime(399));
    expect(screen.getByText('Follow dialog')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Follow dialog')).toBeNull();
    view.unmount();
  });

  it('keeps shared stack while another notification remains open', () => {
    render(<><Notification eventKey="a" durationMs={1000}>A</Notification><Notification eventKey="b" durationMs={1000}>B</Notification></>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Закрыть уведомление' })[0]);
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(document.querySelector('[data-tdn-notifications]')?.children).toHaveLength(1);
  });
});
