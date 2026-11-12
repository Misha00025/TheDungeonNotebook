import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../../theme/ThemeContext';
import PersonalizeModal from '../../PersonalizeModal/PersonalizeModal';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  /**
   * 'default' — обычная кнопка (🎨 на акцентном фоне), для drawer'а.
   * 'rail'    — маленькая ненавязчивая кнопка для свёрнутого рейла:
   *             ~34×34, без акцентного фона, приглушённый цвет.
   */
  variant?: 'default' | 'rail';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'default' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { getCurrentColors } = useTheme();
  const colors = getCurrentColors();

  const isRail = variant === 'rail';

  return (
    <>
      <button
        className={isRail ? styles.toggleRail : styles.toggle}
        onClick={() => setIsOpen(true)}
        title="Настроить тему"
        aria-label="Настроить тему"
        style={isRail ? undefined : { backgroundColor: colors.accentColor }}
      >
        🎨
      </button>
      {isOpen && createPortal(
        <PersonalizeModal isOpen={isOpen} onClose={() => setIsOpen(false)} />,
        document.body
      )}
    </>
  );
};

export default ThemeToggle;
