import { useEffect, useState } from 'react';
import { getEditorColorMode, useOptionalTheme } from '../../theme/ThemeContext';
import { isLight } from '../../theme/color';

type ColorMode = 'light' | 'dark';
const hexColor = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

function readRootColorMode(): ColorMode {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 'light';
  try {
    const background = window.getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    return hexColor.test(background) ? isLight(background) ? 'light' : 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function useMarkdownColorMode(): ColorMode {
  const theme = useOptionalTheme();
  const [rootColorMode, setRootColorMode] = useState<ColorMode>('light');

  useEffect(() => {
    if (theme || typeof document === 'undefined' || typeof window === 'undefined') return;
    const update = () => setRootColorMode(readRootColorMode());
    update();

    const rootObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update);
    rootObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });

    const headObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update);
    if (headObserver && document.head) {
      headObserver.observe(document.head, {
        attributes: true,
        attributeFilter: ['id'],
        characterData: true,
        childList: true,
        subtree: true,
      });
    }

    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : undefined;
    if (media?.addEventListener) media.addEventListener('change', update);
    else media?.addListener?.(update);

    return () => {
      rootObserver?.disconnect();
      headObserver?.disconnect();
      if (media?.removeEventListener) media.removeEventListener('change', update);
      else media?.removeListener?.(update);
    };
  }, [theme]);

  return theme ? getEditorColorMode(theme.themeConfig) : rootColorMode;
}
