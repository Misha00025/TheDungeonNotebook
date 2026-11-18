import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import Panel from '../Panel/Panel';
import type { PanelProps } from '../Panel/Panel';

export type StatePanelProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  kind?: 'info' | 'loading' | 'empty' | 'error';
} & Omit<PanelProps, 'title' | 'children' | 'actions'>;

export default function StatePanel({
  title,
  children,
  actions,
  kind = 'info',
  ...props
}: StatePanelProps) {
  const stateProps = kind === 'loading'
    ? { role: 'status' as const, 'aria-live': 'polite' as const }
    : kind === 'error'
      ? { role: 'alert' as const }
      : {};

  return (
    <Panel {...props} {...stateProps} title={title} headingLevel={3} actions={actions}>
      {children}
    </Panel>
  );
}
