import React from 'react';
import styles from './AdaptiveLayout.module.css';

export interface AdaptiveLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Промежуток между элементами. Число => px, строка => как есть (rem/%). По умолчанию '0.75rem'. */
  gap?: number | string;
  /** Выравнивание элементов по вертикальной оси трека. По умолчанию 'stretch'. */
  align?: 'start' | 'center' | 'end' | 'stretch';
}

const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({
  children,
  gap = '0.75rem',
  align = 'stretch',
  className = '',
  style,
  ...rest
}) => (
  <div
    {...rest}
    className={`${styles.layout} ${className}`.trim()}
    style={{
      '--al-gap': typeof gap === 'number' ? `${gap}px` : gap,
      alignItems: align,
      ...style,
    } as React.CSSProperties}
  >
    {children}
  </div>
);

interface AdaptiveLayoutComponent extends React.FC<AdaptiveLayoutProps> {
  Full: React.FC<React.HTMLAttributes<HTMLDivElement>>;
}

const Full: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...rest }) => (
  <div {...rest} className={`${styles.fullRow} ${className}`.trim()}>
    {children}
  </div>
);

(AdaptiveLayout as AdaptiveLayoutComponent).Full = Full;

export default AdaptiveLayout as AdaptiveLayoutComponent;
