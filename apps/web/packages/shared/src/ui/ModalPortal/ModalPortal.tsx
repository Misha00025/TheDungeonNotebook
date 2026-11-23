import React, { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from '../Buttons/Button';
import modalStyles from '../../styles/modal.module.css';
import styles from './ModalPortal.module.css';

export type ModalPortalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'compact' | 'wide';
  dismissDisabled?: boolean;
};

function NativeModal({ title, subtitle, footer, size = 'compact', dismissDisabled = false, onClose, children }: Omit<ModalPortalProps, 'isOpen' | 'title'> & { title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const openerRef = useRef<HTMLElement | null>(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const previousOverflowRef = useRef('');
  const titleId = useId();
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflowRef.current;
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!dismissDisabled) onCloseRef.current();
  };

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (dismissDisabled || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) onCloseRef.current();
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${size === 'wide' ? styles.wide : styles.compact}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      <header className={styles.header}>
        <div className={styles.heading}><h2 id={titleId} className={styles.title}>{title}</h2>{subtitle != null && <div className={styles.subtitle}>{subtitle}</div>}</div>
        <Button variant="secondary" type="button" aria-label="Закрыть" disabled={dismissDisabled} onClick={() => onCloseRef.current()}>×</Button>
      </header>
      <div className={styles.body}>{children}</div>
      {footer != null && <footer className={styles.footer}>{footer}</footer>}
    </dialog>,
    document.body
  );
}

const ModalPortal: React.FC<ModalPortalProps> = ({ isOpen, onClose, children, title, subtitle, footer, size, dismissDisabled }) => {
  if (title !== undefined) {
    return isOpen ? <NativeModal title={title} subtitle={subtitle} footer={footer} size={size} dismissDisabled={dismissDisabled} onClose={onClose}>{children}</NativeModal> : null;
  }
  if (!isOpen) return null;
  return createPortal(
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={event => event.stopPropagation()}>
        {children}{footer}
      </div>
    </div>,
    document.body
  );
};

export default ModalPortal;
