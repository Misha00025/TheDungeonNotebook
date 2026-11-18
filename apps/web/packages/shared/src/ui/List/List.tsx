import React from 'react';
import styles from './List.module.css';

export interface ListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  layout?: 'vertical' | 'horizontal' | 'grid' | 'start-grid';
  className?: string;
  gap?: 'small' | 'medium' | 'large';
  gridSize?: 'small' | 'medium' | 'large';
  stretch?: boolean;
  minItemWidth?: string;
  columns?: 2 | 3;
}

const List: React.FC<ListProps> = ({
  children,
  layout = 'vertical',
  className = '',
  gap = 'medium',
  gridSize = 'small',
  stretch = false,
  minItemWidth,
  columns,
  style,
  ...props
}) => {
  const layoutClass = styles[`layout-${layout}`];
  const gapClass = styles[`gap-${gap}`];
  const gridClass = styles[`grid-${gridSize}`];
  const columnsClass = columns ? styles[`columns${columns}`] : '';
  const listStyle = {
    '--list-min-width': minItemWidth ?? { small: '250px', medium: '350px', large: '450px' }[gridSize],
    '--list-gap': { small: '0.5rem', medium: '1rem', large: '1.5rem' }[gap],
    ...style,
  } as React.CSSProperties;
  const isGrid = layout === 'grid' || layout === 'start-grid';
  
  return (
    <div {...props} style={listStyle} className={`${styles.list} ${layoutClass} ${gapClass} ${className} ${isGrid ? columnsClass || gridClass : ''} ${layout === 'vertical' && stretch ? styles.stretch : ''}`}>
      {children}
    </div>
  );
};

export default List;
