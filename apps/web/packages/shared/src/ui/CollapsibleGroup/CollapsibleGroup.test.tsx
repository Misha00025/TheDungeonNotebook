import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CollapsibleGroup from './CollapsibleGroup';

const mockItemComponent: React.FC<{ item: { id: number; name: string } }> = ({ item }) => (
  <div data-testid={`skill-${item.id}`} data-id={item.id}>
    {item.name}
  </div>
);

function createGroupStructure(): { id: string; name: string; items: { id: number; name: string }[]; children: any[] } {
  return {
    id: 'root-group',
    name: 'Root Category',
    items: [{ id: 1, name: 'Skill One' }],
    children: [
      {
        id: 'child-group-1',
        name: 'Sub Category',
        items: [{ id: 7, name: 'Skill Seven' }],
        children: [],
      },
    ],
  };
}

describe('CollapsibleGroup — expandedItemId auto-expand', () => {
  const rootGroup = createGroupStructure();

  const renderGroup = (props?: { expandedItemId?: number | null; defaultCollapsed?: boolean }) =>
    render(
      <CollapsibleGroup
        group={rootGroup}
        level={0}
        isMobile={false}
        ItemComponent={mockItemComponent}
        defaultCollapsed={props?.defaultCollapsed ?? false}
        expandedItemId={props?.expandedItemId ?? null}
      />
    );

  test('defaultCollapsed=true without expandedItemId keeps items hidden', () => {
    renderGroup({ defaultCollapsed: true });

    expect(screen.queryByTestId('skill-7')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skill-1')).not.toBeInTheDocument();
    expect(screen.getByText('Root Category (2)')).toBeInTheDocument();
  });

  test('rerender with expandedItemId={7} auto-expands the path to the item', async () => {
    const { rerender } = renderGroup({ defaultCollapsed: true });

    expect(screen.queryByTestId('skill-7')).not.toBeInTheDocument();

    rerender(
      <CollapsibleGroup
        group={rootGroup}
        level={0}
        isMobile={false}
        ItemComponent={mockItemComponent}
        defaultCollapsed={true}
        expandedItemId={7}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('skill-7')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByTestId('skill-1')).toBeInTheDocument();
    expect(screen.getByText('Root Category (2)')).toBeInTheDocument();
    expect(screen.getByText('Sub Category (1)')).toBeInTheDocument();
  });

  test('expandedItemId=nonexistent does not affect defaultCollapsed state', () => {
    renderGroup({ defaultCollapsed: true, expandedItemId: 999 });

    expect(screen.queryByTestId('skill-7')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skill-1')).not.toBeInTheDocument();
  });
});
