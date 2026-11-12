import React, { useState, useEffect, useRef } from 'react';
import { useTheme, PRESET_COLORS } from '../../theme/ThemeContext';
import type { PresetTheme, ThemeConfig } from '../../theme/types';
import type { CustomColors } from '../../theme/types';
import { PRESET_LABELS } from '../../theme/types';
import buttonStyles from '../../styles/components/Button.module.css';
import styles from './PersonalizeModal.module.css';
import AdaptiveLayout from '../AdaptiveLayout/AdaptiveLayout';

interface PersonalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PersonalizeModal: React.FC<PersonalizeModalProps> = ({ isOpen, onClose }) => {
  const { themeConfig, setPreset, setCustomColors, getCurrentColors, pushThemeToServer, syncThemeFromServer, themeSyncing, themeSyncError } = useTheme();
  const currentColors = getCurrentColors();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [customColors, setCustomColorsState] = useState<CustomColors>({ ...currentColors });
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCustomColorsState({ ...getCurrentColors() });
  }, [themeConfig, getCurrentColors]);

  useEffect(() => () => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
  }, []);

  const scheduleThemePush = (config: ThemeConfig) => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushThemeToServer(config);
    }, 400);
  };

  const applyPreset = (name: PresetTheme) => {
    const config: ThemeConfig = { type: 'preset', name };
    setPreset(name);
    scheduleThemePush(config);
  };

  const applyCustomColors = (colors: CustomColors) => {
    const config: ThemeConfig = { type: 'custom', colors };
    setCustomColors(colors);
    scheduleThemePush(config);
  };
  if (!isOpen) return null;

  const handleColorChange = (field: keyof CustomColors) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColors = { ...customColors, [field]: e.target.value };
    setCustomColorsState(newColors);
    // Live preview: сразу применяем кастомные цвета (вычисление дополнительных происходит в контексте)
    applyCustomColors(newColors);
  };

  const handleHexChange = (field: keyof CustomColors) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{0,6}$/.test(val) || val === '') {
      const newColors = { ...customColors, [field]: val };
      setCustomColorsState(newColors);
      // Только если hex-цвет полный (6 символов после #) — сразу применяем
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        applyCustomColors(newColors);
      }
    }
  };

  const handleHexBlur = (field: keyof CustomColors) => () => {
    const val = customColors[field];
    if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
      const current = getCurrentColors();
      setCustomColorsState(prev => ({ ...prev, [field]: current[field] }));
    }
  };

  const handleSync = async () => {
    setSyncMessage(null);
    try {
      await syncThemeFromServer();
      setSyncMessage('Тема синхронизирована');
    } catch {
      /* ошибка уже в themeSyncError */
    }
  };

  const lightPresets: PresetTheme[] = ['clean', 'forest', 'ocean', 'sunset', 'lavender'];
  const darkPresets: PresetTheme[] = ['dark', 'forest-dark', 'ocean-dark', 'sunset-dark', 'lavender-dark'];

  const renderPreset = (name: PresetTheme) => {
    const colors = PRESET_COLORS[name];
    const isActive = themeConfig.type === 'preset' && themeConfig.name === name;
    return (
      <div
        key={name}
        className={`${styles.presetCard} ${isActive ? styles.presetCardActive : ''}`}
        onClick={() => applyPreset(name)}
      >
        <div
          className={styles.colorPreview}
          style={{
            background: `linear-gradient(135deg, ${colors.bgPrimary} 50%, ${colors.accentColor} 50%)`,
          }}
        />
        <span className={styles.presetLabel}>{PRESET_LABELS[name]}</span>
      </div>
    );
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Персонализация темы</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.sectionGroup}>
          <h3 className={styles.groupTitle}>Светлые</h3>
          <div className={styles.presetsGrid}>
            {lightPresets.map(renderPreset)}
          </div>
        </div>

        <div className={styles.sectionGroup}>
          <h3 className={styles.groupTitle}>Тёмные</h3>
          <div className={styles.presetsGrid}>
            {darkPresets.map(renderPreset)}
          </div>
        </div>

        <div className={styles.customSection}>
          <h3 className={styles.customTitle}>Свои цвета</h3>
          {(['bgPrimary', 'textPrimary', 'accentColor'] as (keyof CustomColors)[]).map(field => {
            const labels: Record<string, string> = {
              bgPrimary: 'Фон',
              textPrimary: 'Текст',
              accentColor: 'Акцент',
            };
            return (
              <div className={styles.colorRow} key={field}>
                <label htmlFor={`custom-${field}`}>{labels[field]}</label>
                <input
                  id={`custom-${field}`}
                  type="color"
                  value={customColors[field]}
                  onChange={handleColorChange(field)}
                />
                <input
                  type="text"
                  className={styles.hexInput}
                  value={customColors[field]}
                  onChange={handleHexChange(field)}
                  onBlur={handleHexBlur(field)}
                />
              </div>
            );
          })}

          <h3 className={styles.progressTitle}>Шкала прогресса</h3>
          <AdaptiveLayout className={styles.progressRow} gap={16}>
            <div className={styles.progressItem}>
              <label htmlFor="custom-progressFrom">От</label>
              <input
                id="custom-progressFrom"
                type="color"
                value={customColors.progressFrom}
                onChange={handleColorChange('progressFrom')}
              />
              <input
                type="text"
                className={styles.hexInput}
                value={customColors.progressFrom}
                onChange={handleHexChange('progressFrom')}
                onBlur={handleHexBlur('progressFrom')}
              />
            </div>
            <div className={styles.progressItem}>
              <label htmlFor="custom-progressTo">До</label>
              <input
                id="custom-progressTo"
                type="color"
                value={customColors.progressTo}
                onChange={handleColorChange('progressTo')}
              />
              <input
                type="text"
                className={styles.hexInput}
                value={customColors.progressTo}
                onChange={handleHexChange('progressTo')}
                onBlur={handleHexBlur('progressTo')}
              />
            </div>
          </AdaptiveLayout>
        </div>

        <AdaptiveLayout className={styles.buttons}>
          <AdaptiveLayout.Full>
            {themeSyncing && <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-primary, #6b7280)' }}>Синхронизация...</p>}
            {themeSyncError && <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--danger-color)' }}>{themeSyncError}</p>}
            {syncMessage && !themeSyncError && <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-primary, #6b7280)' }}>{syncMessage}</p>}
          </AdaptiveLayout.Full>
          <button className={buttonStyles.button} onClick={handleSync} disabled={themeSyncing}>
            Синхронизировать
          </button>
          <button className={buttonStyles.button} onClick={() => applyPreset('clean')}>
            Сбросить
          </button>
          <button className={buttonStyles.button} onClick={onClose}>
            Закрыть
          </button>
        </AdaptiveLayout>
      </div>
    </div>
  );
};

export default PersonalizeModal;
