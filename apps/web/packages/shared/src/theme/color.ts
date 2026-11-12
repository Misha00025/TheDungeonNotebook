/**
 * Парсит hex-цвет (#rgb, #rrggbb) в { r, g, b }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/**
 * Конвертирует { r, g, b } обратно в hex-строку
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Линейно интерполирует два цвета
 * amount: 0 = color1, 1 = color2
 */
export function blendHex(color1: string, color2: string, amount: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * amount,
    c1.g + (c2.g - c1.g) * amount,
    c1.b + (c2.b - c1.b) * amount,
  );
}

/**
 * Затемняет hex-цвет на заданный процент (0-1)
 */
export function darkenHex(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount));
}

/**
 * Осветляет hex-цвет на заданный процент (0-1)
 */
export function lightenHex(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(
    c.r + (255 - c.r) * amount,
    c.g + (255 - c.g) * amount,
    c.b + (255 - c.b) * amount,
  );
}

/**
 * Определяет, светлый ли цвет (на основе luminance)
 */
export function isLight(hex: string): boolean {
  const c = hexToRgb(hex);
  const luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return luminance > 128;
}

/**
 * Вычисляет --bg-secondary из --bg-primary:
 * если фон светлый → затемнить на 10%
 * если фон тёмный → осветлить на 15%
 */
export function computeBgSecondary(bgPrimary: string): string {
  return isLight(bgPrimary) ? darkenHex(bgPrimary, 0.1) : lightenHex(bgPrimary, 0.15);
}

/**
 * Вычисляет --text-secondary из --text-primary: смесь 50/50 с серым #888
 */
export function computeTextSecondary(textPrimary: string): string {
  return blendHex(textPrimary, '#888888', 0.55);
}

/**
 * Вычисляет --border-color как среднее между bg-primary и text-primary
 */
export function computeBorderColor(bgPrimary: string, textPrimary: string): string {
  return blendHex(bgPrimary, textPrimary, 0.5);
}

/**
 * Вычисляет --danger-color: красный оттенок на основе акцента
 */
export function computeDangerColor(accentColor: string): string {
  // Берём красный оттенок: смешиваем accentColor с #d93025 (60/40)
  return blendHex(accentColor, '#d93025', 0.4);
}

/**
 * Вычисляет --text-on-accent: белый или чёрный, в зависимости от яркости акцентного цвета
 */
export function computeTextOnAccent(accentColor: string): string {
  return isLight(accentColor) ? '#000000' : '#ffffff';
}

/**
 * Вычисляет --text-shadow: тень нужна, если фон светлый, а текст тёмный (для читаемости на прогресс-баре)
 */
export function computeTextShadow(bgPrimary: string, textPrimary: string): string {
  // Тень нужна только если текст и фон сильно контрастируют
  const bgLight = isLight(bgPrimary);
  const textLight = isLight(textPrimary);
  if (bgLight !== textLight) {
    return '0 0 2px rgba(0,0,0,0.5)';
  }
  return 'none';
}

/**
 * Цвет прогресс-бара при 0% (пустое значение)
 * Фиксированный красный оттенок, не зависит от темы
 */
export function computeProgressFrom(): string {
  return '#e53935';
}

/**
 * Цвет прогресс-бара при 100% (полное значение)
 * Светло-зелёный для светлых тем, тёмно-зелёный для тёмных
 */
export function computeProgressTo(bgPrimary: string): string {
  return isLight(bgPrimary) ? '#66bb6a' : '#43a047';
}
