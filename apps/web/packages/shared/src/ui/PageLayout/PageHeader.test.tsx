import React from 'react';
import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';
import styles from './PageLayout.module.css';

describe('PageHeader', () => {
  test('renders a configurable heading id and actions', () => {
    render(<PageHeader title="Campaign" headingLevel={2} id="campaign-title" actions={<button>Settings</button>} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Campaign' })).toHaveAttribute('id', 'campaign-title');
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  test('accepts React nodes for title and subtitle and uses an empty image alt fallback', () => {
    const { container } = render(<PageHeader title={<span>Editable title</span>} subtitle={<span>Editable subtitle</span>} imageUrl="portrait.png" />);
    expect(screen.getByRole('heading', { name: 'Editable title' })).toBeInTheDocument();
    expect(screen.getByText('Editable subtitle')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  test('renders title aside alongside but outside the heading', () => {
    const { container } = render(
      <PageHeader
        title="Hero"
        titleAside={<span>Ключевой</span>}
        subtitle="Описание"
        actions={<button>Настройки</button>}
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Hero' });
    const titleRow = heading.parentElement;
    expect(titleRow).toHaveClass(styles.headerTitleRow);
    expect(titleRow).toContainElement(screen.getByText('Ключевой'));
    expect(heading).not.toContainElement(screen.getByText('Ключевой'));
    expect(screen.getByText('Описание').parentElement).not.toBe(titleRow);
    expect(screen.getByRole('button', { name: 'Настройки' })).toBeInTheDocument();
    expect(container.querySelector(`.${styles.headerTitleAside}`)).toHaveClass(styles.headerTitleAside);
  });

  test('keeps the heading as a direct header text child without title aside', () => {
    const { container } = render(<PageHeader title="Hero" />);
    const headerText = container.querySelector(`.${styles.headerText}`);
    expect(headerText?.firstElementChild).toHaveClass(styles.headerTitle);
    expect(headerText?.firstElementChild?.tagName).toBe('H1');
  });
});
