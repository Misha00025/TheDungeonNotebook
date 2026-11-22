import React from 'react';
import { Button } from '@tdn/shared';
import type { CatalogGroupSummary } from './catalogTypes';

export type CatalogGroupTreeProps = {
  groups: CatalogGroupSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
};

const CatalogGroupTree: React.FC<CatalogGroupTreeProps> = ({ groups, selectedId, onSelect }) => {
  const ids = new Set(groups.map(group => group.id));
  const rendered = new Set<string>();

  const renderBranch = (group: CatalogGroupSummary, ancestors: Set<string>): React.ReactNode => {
    if (ancestors.has(group.id) || rendered.has(group.id)) return null;
    rendered.add(group.id);
    const nextAncestors = new Set(ancestors).add(group.id);
    const children = groups.filter(candidate => candidate.parentId === group.id);
    return <li key={group.id}>
      <Button
        variant={selectedId === group.id ? 'primary' : 'secondary'}
        onClick={() => onSelect(selectedId === group.id ? '' : group.id)}
      >{group.title}</Button>
      {children.length > 0 && <ul>{children.map(child => renderBranch(child, nextAncestors))}</ul>}
    </li>;
  };

  const roots = groups.filter(group => !group.parentId || !ids.has(group.parentId));
  const rootItems = roots.map(group => renderBranch(group, new Set<string>()));
  const detached = groups.filter(group => !rendered.has(group.id)).map(group => renderBranch(group, new Set<string>()));
  const tree = [...rootItems, ...detached].filter(Boolean);

  if (groups.length === 0) return null;
  return <nav aria-label="Группы каталога"><ul>{tree}</ul></nav>;
};

export default CatalogGroupTree;
