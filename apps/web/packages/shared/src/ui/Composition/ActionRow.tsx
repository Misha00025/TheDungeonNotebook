import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import AdaptiveLayout from '../AdaptiveLayout/AdaptiveLayout';
import styles from './Composition.module.css';

export type ActionRowProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  justify?: 'start' | 'end';
};

export default function ActionRow({ children, justify = 'start', className, ...props }: ActionRowProps) {
  return (
    <AdaptiveLayout
      {...props}
      align="center"
      className={[styles.actionRow, justify === 'end' && styles.end, className].filter(Boolean).join(' ')}
    >
      {children}
    </AdaptiveLayout>
  );
}
