// components/SearchBar/SearchBar.tsx
import React, { useState, useEffect } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  showClearButton?: boolean;
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = "Поиск...",
  onClear,
  showClearButton = true,
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasText, setHasText] = useState(false);

  useEffect(() => {
    setHasText(searchTerm.length > 0);
  }, [searchTerm]);

  const handleClear = () => {
    onSearchChange('');
    if (onClear) {
      onClear();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && hasText) {
      handleClear();
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.searchWrapper} ${isFocused ? styles.focused : ''} ${hasText ? styles.hasText : ''}`}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className={styles.searchInput}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        
        <div className={styles.underline}></div>
        
        {showClearButton && hasText && (
          <button
            onClick={handleClear}
            className={styles.clearButton}
            type="button"
            aria-label="Очистить поиск"
          >
            <svg
              className={styles.clearIcon}
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;