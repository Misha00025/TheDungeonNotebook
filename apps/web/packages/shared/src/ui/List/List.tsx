import React from 'react';
import styles from './List.module.css';

export interface ListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  layout?: 'vertical' | 'horizontal' | 'grid' | 'start-grid';
  className?: string;
  gap?: 'small' | 'medium' | 'large';
  gridSize?: 'small' | 'medium' | 'large';
  stretch?: boolean;
}

const List: React.FC<ListProps> = ({
  children,
  layout = 'vertical',
  className = '',
  gap = 'medium',
  gridSize = 'small',
  stretch = false,
  ...props
}) => {
  const layoutClass = styles[`layout-${layout}`];
  const gapClass = styles[`gap-${gap}`];
  const gridClass = styles[`grid-${gridSize}`];
  
  return (
    <div {...props} className={`${styles.list} ${layoutClass} ${gapClass} ${className} ${layout === 'grid' || layout === 'start-grid' ? gridClass : ''} ${layout === 'vertical' && stretch ? styles.stretch : ''}`}>
      {children}
    </div>
  );
};

export default List;
