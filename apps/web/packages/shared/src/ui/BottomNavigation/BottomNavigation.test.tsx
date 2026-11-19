import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BottomNavigation from './BottomNavigation';

let resize: () => void = () => {};
let mobileMatches = true;
let mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const originalRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resize = () => callback([], this as unknown as ResizeObserver);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

const rect = (width: number) => ({ x: 0, y: 0, width, height: 100, top: 0, right: width, bottom: 100, left: 0, toJSON: () => ({}) }) as DOMRect;
const Path: React.FC = () => <output aria-label="Path">{useLocation().pathname}</output>;
const items = Array.from({ length: 7 }, (_, index) => ({
  id: `item-${index + 1}`,
  label: `Item ${index + 1}`,
  icon: <span>{index + 1}</span>,
  to: `/item-${index + 1}`,
  active: index === 6,
}));

beforeEach(() => {
  resize = () => {};
  mobileMatches = true;
  mediaListeners = new Set();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      media: query,
      get matches() { return mobileMatches; },
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
      dispatchEvent: () => true,
    }),
  });
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return rect(this.getAttribute('aria-label') ? 360 : 72);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalRect) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', originalRect);
  else Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect');
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
});

describe('BottomNavigation', () => {
  it('measures capacity, keeps the first item pinned, and exposes active overflow from More', async () => {
    render(<MemoryRouter><BottomNavigation aria-label="Campaign" items={items} /></MemoryRouter>);
    const navigation = await screen.findByRole('navigation', { name: 'Campaign' });
    let navigationWidth = 360;
    vi.spyOn(navigation, 'getBoundingClientRect').mockImplementation(() => rect(navigationWidth));
    act(() => resize());

    let links = within(navigation).getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveTextContent('Item 1');
    expect(links[0]).toHaveAttribute('href', '/item-1');
    let more = within(navigation).getByRole('button', { name: 'Ещё' });
    fireEvent.click(more);
    expect(within(navigation).getByRole('link', { name: 'Item 7' })).toHaveAttribute('aria-current', 'page');
    fireEvent.keyDown(more, { key: 'Escape' });

    navigationWidth = 216;
    act(() => resize());
    links = within(navigation).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Item 1');
    more = within(navigation).getByRole('button', { name: 'Ещё' });
    expect(more).toBeInTheDocument();
  });

  it('renders all router items as anchors when they fit measured capacity', async () => {
    render(<MemoryRouter initialEntries={['/start']}><BottomNavigation aria-label="Sections" items={items.slice(0, 4)} /><Path /></MemoryRouter>);
    const navigation = await screen.findByRole('navigation', { name: 'Sections' });
    vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue(rect(360));
    act(() => resize());
    const links = within(navigation).getAllByRole('link');
    expect(links).toHaveLength(4);
    const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    fireEvent(links[0], modifiedClick);
    expect(modifiedClick.defaultPrevented).toBe(false);
    expect(screen.getByLabelText('Path')).toHaveTextContent('/start');
    expect(within(navigation).queryByRole('button', { name: 'Ещё' })).not.toBeInTheDocument();
  });

  it('measures capacity from the navigation inner width after horizontal padding', async () => {
    render(<MemoryRouter><BottomNavigation aria-label="Padded sections" items={items} /></MemoryRouter>);
    const navigation = await screen.findByRole('navigation', { name: 'Padded sections' });
    vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue(rect(360));
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      if (element === navigation) return { paddingLeft: '36px', paddingRight: '36px' } as CSSStyleDeclaration;
      return getComputedStyle(element, pseudoElement);
    });
    act(() => resize());
    expect(within(navigation).getAllByRole('link')).toHaveLength(3);
    expect(within(navigation).getByRole('button', { name: 'Ещё' })).toBeInTheDocument();
  });

  it('omits navigation on desktop', () => {
    mobileMatches = false;
    render(<MemoryRouter><BottomNavigation aria-label="Sections" items={items} /></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });
});
