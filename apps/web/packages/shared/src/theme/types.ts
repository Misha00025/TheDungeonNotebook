export type PresetTheme = 'clean' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'forest-dark' | 'ocean-dark' | 'sunset-dark' | 'lavender-dark';

export interface CustomColors {
  bgPrimary: string;
  textPrimary: string;
  accentColor: string;
  progressFrom: string;
  progressTo: string;
}

export type ThemeConfig =
  | { type: 'preset'; name: PresetTheme }
  | { type: 'custom'; colors: CustomColors };

// Для сериализации в localStorage
export const DEFAULT_THEME: ThemeConfig = { type: 'preset', name: 'clean' };

export const PRESET_LABELS: Record<PresetTheme, string> = {
  clean: 'Светлая',
  dark: 'Тёмная',
  ocean: 'Океан',
  forest: 'Лес',
  sunset: 'Закат',
  lavender: 'Лаванда',
  'forest-dark': 'Тёмный лес',
  'ocean-dark': 'Тёмный океан',
  'sunset-dark': 'Тёмный закат',
  'lavender-dark': 'Тёмная лаванда',
};
