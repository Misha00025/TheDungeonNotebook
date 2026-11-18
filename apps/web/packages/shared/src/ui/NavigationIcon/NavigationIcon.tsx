import React from 'react';

export type NavigationIconName = 'home' | 'people' | 'document' | 'function' | 'layout' | 'access' | 'settings' | 'arrow-left' | 'chart';

export type NavigationIconProps = {
  name: NavigationIconName;
};

const paths: Record<NavigationIconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20z" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V20h-4" /></>,
  document: <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 16h6" /></>,
  function: <><path d="m4 19 5-14h6M6 12h7M14 14l6 6M20 14l-6 6" /></>,
  layout: <><rect x="3.5" y="4" width="17" height="16" rx="1.5" /><path d="M3.5 9h17M9 9v11" /></>,
  access: <><rect x="4.5" y="10" width="15" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  settings: <><path d="m10 3.5-.6 2.2a6.8 6.8 0 0 0-1.6.9L5.7 5.8 4 8.7l1.8 1.4a7.2 7.2 0 0 0 0 1.8L4 13.3l1.7 2.9 2.1-.8a6.8 6.8 0 0 0 1.6.9l.6 2.2h4l.6-2.2a6.8 6.8 0 0 0 1.6-.9l2.1.8 1.7-2.9-1.8-1.4a7.2 7.2 0 0 0 0-1.8L20 8.7l-1.7-2.9-2.1.8a6.8 6.8 0 0 0-1.6-.9L14 3.5z" /><circle cx="12" cy="11" r="2.5" /></>,
  'arrow-left': <><path d="M20 12H4M11 5l-7 7 7 7" /></>,
  chart: <><path d="M4 20V4M4 20h17" /><rect x="7" y="12" width="3" height="6" rx="0.5" /><rect x="12" y="8" width="3" height="10" rx="0.5" /><rect x="17" y="5" width="3" height="13" rx="0.5" /></>,
};

export default function NavigationIcon({ name }: NavigationIconProps) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
