import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from './InlineValueEditor.module.css';

const InlineValueEditor: React.FC<{ display: React.ReactNode; label: string; disabled: boolean; issue?: string; onCommit: () => void; children: React.ReactNode }> = ({ display, label, disabled, issue, onCommit, children }) => {
  const [editing, setEditing] = useState(false);
  const [sessionDisplay, setSessionDisplay] = useState<React.ReactNode>(display);
  const editingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const finishingRef = useRef(false);
  const displayContent = <>{display}{issue && <span className={styles.issue} aria-hidden="true">!</span>}</>;

  useLayoutEffect(() => {
    if (!editing) return;
    const input = rootRef.current?.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea, select, input[type="checkbox"]');
    input?.focus();
    if (input instanceof HTMLInputElement && input.type !== 'checkbox') input.select();
  }, [editing]);

  const finish = (commit: boolean) => {
    if (!editingRef.current || finishingRef.current) return;
    finishingRef.current = true;
    editingRef.current = false;
    setEditing(false);
    if (commit && !disabled) onCommit();
  };

  return <div ref={rootRef} className={styles.editor} onBlur={event => {
    if (!editingRef.current) return;
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    finish(true);
  }} onKeyDown={event => {
    if (!editingRef.current) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); return; }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault(); event.stopPropagation(); finish(true);
    }
  }}>
    {editing ? <><span className={styles.sizer} aria-hidden="true" inert>{sessionDisplay}</span><div className={styles.inputLayer}>{children}</div></> : <button className={styles.display} type="button" aria-label={`Изменить показатель ${label}`} aria-invalid={Boolean(issue)} title={issue} disabled={disabled} onClick={event => { event.stopPropagation(); finishingRef.current = false; editingRef.current = true; setSessionDisplay(displayContent); setEditing(true); }} onKeyDown={event => event.stopPropagation()}>{displayContent}</button>}
  </div>;
};

export default InlineValueEditor;
