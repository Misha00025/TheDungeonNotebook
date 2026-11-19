import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkspaceLayout from './WorkspaceLayout';
import SectionNav from '../SectionNav/SectionNav';

describe('WorkspaceLayout', () => {
  test('renders accessible navigation and content', () => {
    render(<WorkspaceLayout navigation={<nav aria-label="Sections">Navigation</nav>}>Content</WorkspaceLayout>);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toHaveTextContent('Navigation');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('SectionNav', () => {
  test('renders router links, active state, and click handler', () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <SectionNav
          aria-label="Campaign sections"
          items={[
            { label: 'Overview', to: '/overview', active: true, onClick },
            { label: 'Members', to: '/members' },
          ]}
        />
      </MemoryRouter>
    );
    const activeLink = screen.getByRole('link', { name: 'Overview' });
    expect(activeLink).toHaveAttribute('href', '/overview');
    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('href', '/members');
    activeLink.click();
    expect(onClick).toHaveBeenCalled();
  });
});
