import React, { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './ClampedText.module.css';

export type ClampedTextProps = {
  children: string;
  className?: string;
  maxHeight?: string;
};

export default function ClampedText({ children, className, maxHeight }: ClampedTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState(1);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return;

    const updateLines = () => {
      const maxHeightValue = maxHeight === undefined ? Number.NaN : Number.parseFloat(getComputedStyle(root).maxHeight);
      const height = Number.isFinite(maxHeightValue) ? maxHeightValue : root.clientHeight;
      const computed = getComputedStyle(inner);
      let lineHeight = Number.parseFloat(computed.lineHeight);
      if (computed.lineHeight === 'normal') {
        const fontSize = Number.parseFloat(computed.fontSize);
        lineHeight = fontSize * 1.4;
      }
      if (height <= 0 || !Number.isFinite(lineHeight) || lineHeight <= 0) return;
      const nextLines = Math.max(1, Math.floor(height / lineHeight));
      setLines(current => current === nextLines ? current : nextLines);
    };

    updateLines();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateLines);
    observer.observe(root);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [children, className, maxHeight]);

  const rootStyle: CSSProperties | undefined = maxHeight === undefined ? undefined : { maxHeight, height: 'auto' };
  return <span ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')} style={rootStyle}><span ref={innerRef} className={styles.inner} style={{ WebkitLineClamp: lines } as CSSProperties}>{children}</span></span>;
}
