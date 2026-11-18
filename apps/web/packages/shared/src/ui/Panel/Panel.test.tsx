import React from 'react';
import { render, screen } from '@testing-library/react';
import Panel from './Panel';

describe('Panel', () => {
  test('renders requested semantic heading and footer actions', () => {
    render(<Panel title="Details" headingLevel={3} actions={<button>Save</button>}>Content</Panel>);
    expect(screen.getByRole('heading', { level: 3, name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toContainElement(screen.getByRole('button', { name: 'Save' }));
  });
});
