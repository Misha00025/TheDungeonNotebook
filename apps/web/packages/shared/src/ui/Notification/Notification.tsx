import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IconButton from '../Buttons/IconButton/IconButton';
import styles from './Notification.module.css';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export type NotificationProps = {
  kind?: NotificationKind;
  children: React.ReactNode;
  eventKey?: unknown;
  durationMs?: number;
};

const headings: Record<NotificationKind, string> = {
  success: 'Успех',
  error: 'Ошибка',
  warning: 'Предупреждение',
  info: 'Информация',
};

function getDefaultKey(kind: NotificationKind, children: React.ReactNode) {
  return typeof children === 'string' || typeof children === 'number' ? children : kind;
}

type EventProps = { kind: NotificationKind; children: React.ReactNode; durationMs: number };

function NotificationEvent({ kind, children, durationMs }: EventProps) {
  const [visible, setVisible] = useState(true);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pausedHover, setPausedHover] = useState(false);
  const [pausedFocus, setPausedFocus] = useState(false);
  const remaining = useRef(durationMs);
  const deadline = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    let root = document.querySelector<HTMLElement>('[data-tdn-notifications]');
    if (!root) {
      root = document.createElement('div');
      root.dataset.tdnNotifications = '';
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', 'Уведомления');
      root.className = styles.viewport;
      document.body.appendChild(root);
    }
    const holder = document.createElement('div');
    holder.dataset.tdnNotificationSlot = '';
    root.appendChild(holder);
    setHost(holder);
    const place = () => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      const target: HTMLElement = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
      if (root && root.parentElement !== target) target.appendChild(root);
    };
    place();

    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });

    return () => {
      observer.disconnect();
      holder.remove();
      if (root && root.childElementCount === 0) root.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || pausedHover || pausedFocus || !host) return;
    const start = remaining.current;
    deadline.current = Date.now() + start;
    timeout.current = setTimeout(() => setVisible(false), start);
    return () => {
      if (timeout.current !== null) clearTimeout(timeout.current);
      timeout.current = null;
      if (deadline.current) remaining.current = Math.max(0, deadline.current - Date.now());
    };
  }, [visible, pausedHover, pausedFocus, host]);

  if (!host || !visible) return null;
  const paused = pausedHover || pausedFocus;
  const close = () => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
    setVisible(false);
  };

  return createPortal(
    <div className={`${styles.card} ${styles[kind]}`} role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
      onMouseEnter={() => setPausedHover(true)} onMouseLeave={() => setPausedHover(false)}
      onFocus={() => setPausedFocus(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPausedFocus(false); }}>
      <div className={styles.heading}>{headings[kind]}</div>
      <div className={styles.body}>{children}</div>
      <IconButton icon="close" title="Закрыть уведомление" ariaLabel="Закрыть уведомление" size="small" variant="secondary" onClick={close} className={styles.close} />
      <div className={`${styles.progress} ${paused ? styles.paused : ''}`} aria-label="Время до закрытия уведомления" style={{ '--notification-duration': `${durationMs}ms` } as React.CSSProperties} />
    </div>, host
  );
}

function Notification({ kind = 'info', children, eventKey, durationMs = 6000 }: NotificationProps) {
  const identity = eventKey === undefined ? getDefaultKey(kind, children) : eventKey;
  const [event, setEvent] = useState(() => ({ identity, kind, durationMs, sequence: 0 }));

  if (!Object.is(event.identity, identity) || event.kind !== kind || event.durationMs !== durationMs) {
    setEvent({ identity, kind, durationMs, sequence: event.sequence + 1 });
  }

  return <NotificationEvent key={event.sequence} kind={kind} durationMs={durationMs}>{children}</NotificationEvent>;
}

export default Notification;
