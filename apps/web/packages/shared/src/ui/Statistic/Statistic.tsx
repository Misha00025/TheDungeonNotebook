import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import Panel from '../Panel/Panel';
import styles from './Statistic.module.css';

export type StatisticProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  label: string;
  value: ReactNode;
  busy?: boolean;
};

export default function Statistic({ label, value, busy = false, className, title: tooltip, ...props }: StatisticProps) {
  return (
    <Panel
      {...props}
      as="article"
      aria-label={label}
      aria-busy={busy || undefined}
      className={className}
    >
      <dl className={styles.statistic} title={tooltip}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </dl>
    </Panel>
  );
}
