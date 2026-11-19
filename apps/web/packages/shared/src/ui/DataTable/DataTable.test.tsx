import React from 'react';
import { render, screen } from '@testing-library/react';
import DataTable from './DataTable';

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

  test('forwards native table attributes', () => {
    render(
      <DataTable
        aria-label="Fields"
        data-testid="fields-table"
      >
        <tbody><tr><td>Field</td></tr></tbody>
      </DataTable>,
    );

    expect(screen.getByTestId('fields-table')).toHaveAttribute('data-testid', 'fields-table');
    expect(screen.getByRole('table', { name: 'Fields' })).toBeInTheDocument();
  });
});
