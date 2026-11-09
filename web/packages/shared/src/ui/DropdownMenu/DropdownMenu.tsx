// components/commons/DropdownMenu/DropdownMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import styles from './DropdownMenu.module.css';

export interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface DropdownMenuProps {
  items: MenuItem[];
  buttonContent?: React.ReactNode;
  buttonTitle?: string;
  align?: 'left' | 'right';
  position?: 'bottom' | 'top';
  className?: string;
  disabled?: boolean;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  buttonContent,
  buttonTitle = 'Действия',
  align = 'right',
  position = 'bottom',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleButtonClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleItemClick = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={`${styles.dropdownMenu} ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={handleButtonClick}
        className={styles.menuButton}
        title={buttonTitle}
        disabled={disabled}
      >
        {buttonContent || '⋮'}
      </button>
      
      {isOpen && (
        <div 
          className={`${styles.menu} ${styles[`align-${align}`]} ${styles[`position-${position}`]}`}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={(e) => handleItemClick(item, e)}
              className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''} ${item.variant ? styles[`variant-${item.variant}`] : ''}`}
              disabled={item.disabled}
            >
              {item.icon && <span className={styles.menuIcon}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;