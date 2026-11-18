// components/commons/DropdownMenu/DropdownMenu.tsx
import React, { useState, useRef, useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import type { To } from 'react-router-dom';
import styles from './DropdownMenu.module.css';

export interface MenuItem {
  label: string;
  onClick?: () => void;
  to?: To;
  active?: boolean;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface DropdownMenuProps {
  items: MenuItem[];
  buttonContent?: React.ReactNode;
  buttonTitle?: string;
  align?: 'left' | 'right';
  position?: 'bottom' | 'top';
  className?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  buttonContent,
  buttonTitle = 'Действия',
  align = 'right',
  position = 'bottom',
  className = '',
  disabled = false,
  buttonClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

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
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    item.onClick?.();
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
  };

  return (
    <div className={`${styles.dropdownMenu} ${className}`} ref={menuRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        className={`${styles.menuButton} ${buttonClassName}`}
        title={buttonTitle}
        aria-label={buttonTitle}
        aria-expanded={isOpen}
        aria-controls={menuId}
        disabled={disabled}
      >
        {buttonContent || '⋮'}
      </button>
      
      {isOpen && (
        <div
          id={menuId}
          className={`${styles.menu} ${styles[`align-${align}`]} ${styles[`position-${position}`]}`}
        >
          {items.map((item, index) => {
            const itemClassName = `${styles.menuItem} ${item.disabled ? styles.disabled : ''} ${item.active ? styles.active : ''} ${item.variant ? styles[`variant-${item.variant}`] : ''}`;
            const content = <>{item.icon != null && <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>}{item.label}</>;
            return item.to !== undefined ? (
              <Link
                key={index}
                to={item.to}
                onClick={event => handleItemClick(item, event)}
                aria-current={item.active ? 'page' : undefined}
                aria-disabled={item.disabled || undefined}
                tabIndex={item.disabled ? -1 : undefined}
                className={itemClassName}
              >
                {content}
              </Link>
            ) : (
              <button
                key={index}
                type="button"
                onClick={event => handleItemClick(item, event)}
                className={itemClassName}
                disabled={item.disabled}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
