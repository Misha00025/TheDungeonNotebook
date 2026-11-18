import React from 'react';
import { render, screen } from '@testing-library/react';
import StatePanel from './StatePanel';

describe('StatePanel', () => {
  test('loading is announced politely', () => {
    render(<StatePanel kind="loading" title="Loading">Please wait</StatePanel>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  test('empty has no alert role', () => {
    render(<StatePanel kind="empty">Nothing here</StatePanel>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('error is announced as an alert', () => {
    render(<StatePanel kind="error">Unable to load</StatePanel>);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load');
  });
});
