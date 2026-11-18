import React from 'react';
import { render, screen } from '@testing-library/react';
import Panel from './Panel';
import styles from './Panel.module.css';

describe('Panel', () => {
  test('renders requested semantic heading and footer actions', () => {
    render(<Panel title="Details" headingLevel={3} actions={<button>Save</button>}>Content</Panel>);
    expect(screen.getByRole('heading', { level: 3, name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toContainElement(screen.getByRole('button', { name: 'Save' }));
  });

  test('omits the body when only a title is supplied', () => {
    const { container } = render(<Panel title="Details" />);
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(container.querySelector(`.${styles.body}`)).toBeNull();
  });

  test('renders body-only content without a heading or header', () => {
    const { container } = render(<Panel as="article">Body content</Panel>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector(`.${styles.body}`)).toHaveTextContent('Body content');
  });
});
