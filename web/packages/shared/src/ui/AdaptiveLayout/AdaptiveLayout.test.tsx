import React from 'react';
import { render, screen } from '@testing-library/react';
import AdaptiveLayout from './AdaptiveLayout';

describe('AdaptiveLayout', () => {
  test('renders children', () => {
    render(
      <>
        <AdaptiveLayout>
          <button>First</button>
          <button>Second</button>
        </AdaptiveLayout>
      </>
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('defaults', () => {
    const { container } = render(<AdaptiveLayout>children</AdaptiveLayout>);
    const el = container.querySelector('div') as HTMLElement;
    expect(el?.className).toContain('layout');
    expect(el?.style.getPropertyValue('--al-gap')).toBe('0.75rem');
  });

  test('gap as number converts to px', () => {
    const { container } = render(
      <AdaptiveLayout gap={10}>
        test
      </AdaptiveLayout>
    );
    const el = container.querySelector('div') as HTMLElement;
    expect(el?.style.getPropertyValue('--al-gap')).toBe('10px');
  });

  test('string values passed through', () => {
    const { container } = render(
      <AdaptiveLayout gap="1rem">
        test
      </AdaptiveLayout>
    );
    const el = container.querySelector('div') as HTMLElement;
    expect(el?.style.getPropertyValue('--al-gap')).toBe('1rem');
  });

  test('Full spans full row', () => {
    const { container } = render(
      <AdaptiveLayout>
        <AdaptiveLayout.Full>msg</AdaptiveLayout.Full>
      </AdaptiveLayout>
    );
    const el = container.querySelectorAll('div')[1] as HTMLElement;
    expect(el?.className).toContain('fullRow');
  });

  test('passes className and extra props', () => {
    const { container } = render(
      <AdaptiveLayout className="my" data-testid="x">
        test
      </AdaptiveLayout>
    );
    const el = container.querySelector('div[data-testid="x"]') as HTMLElement;
    expect(el?.className).toContain('layout');
    expect(el?.className).toContain('my');
    expect(el?.getAttribute('data-testid')).toBe('x');
  });

  test('default align is stretch, custom align applied', () => {
    const { container } = render(
      <AdaptiveLayout align="center">
        test
      </AdaptiveLayout>
    );
    const el = container.querySelector('div') as HTMLElement;
    expect(el?.style.getPropertyValue('align-items')).toBe('center');
  });
});
