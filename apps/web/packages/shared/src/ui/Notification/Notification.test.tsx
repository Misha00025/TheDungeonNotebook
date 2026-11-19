import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Notification from './Notification';

describe('Notification', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.querySelectorAll('dialog[data-notification-test-dialog]').forEach(node => node.remove());
  });

  it('renders notification variants with accessible roles and labels', () => {
    render(<><Notification kind="success">S</Notification><Notification kind="error">E</Notification><Notification kind="warning">W</Notification><Notification kind="info">I</Notification></>);
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(within(screen.getAllByRole('status')[0]).getByText('Успех')).toBeInTheDocument();
    expect(within(screen.getAllByRole('status')[0]).getByText('S')).toBeInTheDocument();
    expect(within(screen.getAllByRole('alert')[0]).getByText('Ошибка')).toBeInTheDocument();
    expect(within(screen.getAllByRole('alert')[0]).getByText('E')).toBeInTheDocument();
    expect(within(screen.getAllByRole('alert')[1]).getByText('Предупреждение')).toBeInTheDocument();
    expect(within(screen.getAllByRole('alert')[1]).getByText('W')).toBeInTheDocument();
    expect(within(screen.getAllByRole('status')[1]).getByText('Информация')).toBeInTheDocument();
    expect(within(screen.getAllByRole('status')[1]).getByText('I')).toBeInTheDocument();
  });

  it('dismisses after timeout and manual close', () => {
    const { rerender } = render(<Notification durationMs={1000}>Expires</Notification>);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Expires')).toBeNull();
    rerender(<Notification eventKey="manual" durationMs={1000}>Manual</Notification>);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(screen.queryByText('Manual')).toBeNull();
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
    expect(screen.getByRole('status')).toHaveTextContent('Exists');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Exists');
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByRole('status')).toHaveTextContent('Exists');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Exists')).toBeNull();
  });

  it('commits new text with an explicit new event key and resets its lifetime', async () => {
    const view = render(<Notification kind="warning" eventKey="before" durationMs={1000}>Before</Notification>);
    act(() => vi.advanceTimersByTime(400));
    view.rerender(<Notification kind="warning" eventKey="after" durationMs={1000}>After</Notification>);
    expect(screen.getByRole('alert')).toHaveTextContent('After');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('alert')).toHaveTextContent('After');
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByRole('alert')).toHaveTextContent('After');
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

  it('keeps one notification and timer through StrictMode replay and cleans them on unmount', () => {
    const view = render(<StrictMode><Notification durationMs={1000}>One</Notification></StrictMode>);
    expect(screen.getByRole('status')).toHaveTextContent('One');
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(screen.queryByText('One')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the notification lifetime when a dialog opens and closes', async () => {
    const view = render(<Notification durationMs={1000}>Follow dialog</Notification>);
    act(() => vi.advanceTimersByTime(300));
    const dialog = document.createElement('dialog');
    dialog.dataset.notificationTestDialog = '';
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    await act(async () => { await Promise.resolve(); });
    act(() => vi.advanceTimersByTime(300));
    dialog.removeAttribute('open');
    await act(async () => { await Promise.resolve(); });
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
  });
});
