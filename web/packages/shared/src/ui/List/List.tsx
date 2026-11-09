import React from 'react';
import styles from './List.module.css';

interface ListProps {
  children: React.ReactNode;
  layout?: 'vertical' | 'horizontal' | 'grid' | 'start-grid';
  className?: string;
  gap?: 'small' | 'medium' | 'large';
  gridSize?: 'small' | 'medium' | 'large'
}

const List: React.FC<ListProps> = ({
  children,
  layout = 'vertical',
  className = '',
  gap = 'medium',
  gridSize = 'small'
}) => {
  const layoutClass = styles[`layout-${layout}`];
  const gapClass = styles[`gap-${gap}`];
  const gridClass = styles[`grid-${gridSize}`];
  
  return (
    <div className={`${styles.list} ${layoutClass} ${gapClass} ${className} ${layout === 'grid' || layout === 'start-grid' ? gridClass : ''}`}>
      {children}
    </div>
  );
};

export default List;