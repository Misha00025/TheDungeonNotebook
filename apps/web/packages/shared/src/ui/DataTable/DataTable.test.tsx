import React from 'react';
import { render, screen } from '@testing-library/react';
import DataTable from './DataTable';
import styles from './DataTable.module.css';

describe('DataTable', () => {
  test('renders native table headings and cells with its accessible name', () => {
    render(
      <DataTable aria-label="Template fields">
        <thead><tr><th scope="col">Name</th><th scope="col">Type</th></tr></thead>
        <tbody><tr><td>Strength</td><td>Number</td></tr></tbody>
      </DataTable>,
    );

    expect(screen.getByRole('table', { name: 'Template fields' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Strength' })).toBeInTheDocument();
  });

  test('merges wrapper and table classes and forwards native table attributes', () => {
    render(
      <DataTable
        aria-label="Fields"
        className="custom-table"
        wrapperClassName="custom-wrapper"
        data-testid="fields-table"
      >
        <tbody><tr><td>Field</td></tr></tbody>
      </DataTable>,
    );

    expect(screen.getByTestId('fields-table')).toHaveClass(styles.table, 'custom-table');
    expect(screen.getByTestId('fields-table').parentElement).toHaveClass(styles.wrapper, 'custom-wrapper');
    expect(screen.getByRole('table', { name: 'Fields' })).toBeInTheDocument();
  });

  test('sets default and custom minimum width and merges table styles', () => {
    const { rerender } = render(<DataTable data-testid="default-table"><tbody /></DataTable>);
    const defaultTable = screen.getByTestId('default-table');

    expect(defaultTable.style.getPropertyValue('--table-min-width')).toBe('40rem');
    expect(defaultTable.style.minWidth).toBe('var(--table-min-width)');
    expect(defaultTable.style.width).toBe('100%');
    expect(defaultTable.style.borderCollapse).toBe('collapse');

    rerender(
      <DataTable
        data-testid="custom-table"
        minWidth="32rem"
        style={{ color: 'red', width: '90%' }}
      >
        <tbody />
      </DataTable>,
    );
    const customTable = screen.getByTestId('custom-table');

    expect(customTable.style.getPropertyValue('--table-min-width')).toBe('32rem');
    expect(customTable.style.minWidth).toBe('var(--table-min-width)');
    expect(customTable.style.width).toBe('90%');
    expect(customTable.style.color).toBe('red');
  });
});
