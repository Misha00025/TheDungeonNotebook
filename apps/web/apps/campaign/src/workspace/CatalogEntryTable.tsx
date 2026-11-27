import React from 'react';
import { Badge, DataTable, DataTableActions, DataTableCell, DataTableControl, DataTableNote, DataTableRow, DataTableRowAction, IconButton } from '@tdn/shared';
import type { ReactNode } from 'react';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';
import { catalogAttributeTags } from './catalogAttributeTags';

export type CatalogEntryTableProps = {
  children: ReactNode;
  label: string;
  showQuantity?: boolean;
  showSelection?: boolean;
  attributeDefinitions?: CatalogAttributeDefinition[];
};

export type CatalogEntryTableRowProps = {
  name: string;
  onOpen: () => void;
  definitions?: CatalogAttributeDefinition[];
  values?: CatalogAttributeOccurrence[];
  attributesLoading?: boolean;
  attributesError?: unknown;
  onRetryAttributes?: () => void;
  quantity?: ReactNode;
  selection?: ReactNode;
  openDisabled?: boolean;
  note?: ReactNode;
  attributeIds?: string[] | null;
};

export const CatalogEntryTable: React.FC<CatalogEntryTableProps> = ({ children, label, showQuantity = false, showSelection = false, attributeDefinitions }) => <DataTable aria-label={label}>
  <thead><tr><DataTableCell as="th" scope="col" sizing="content">Имя</DataTableCell>{attributeDefinitions
    ? attributeDefinitions.map(definition => <DataTableCell key={definition.id} as="th" scope="col">{definition.title}</DataTableCell>)
    : <DataTableCell as="th" scope="col">Атрибуты</DataTableCell>}{showQuantity && <DataTableCell as="th" scope="col" sizing="control">Количество</DataTableCell>}{showSelection && <DataTableCell as="th" scope="col" sizing="control">Выбор</DataTableCell>}</tr></thead>
  <tbody>{children}</tbody>
</DataTable>;

export const CatalogEntryTableRow: React.FC<CatalogEntryTableRowProps> = ({ name, onOpen, definitions, values, attributesLoading = false, attributesError, onRetryAttributes, quantity, selection, openDisabled = false, note, attributeIds }) => {
  const allTags = definitions && values ? catalogAttributeTags(definitions, values) : [];
  const tags = attributeIds !== undefined ? allTags.filter(tag => (attributeIds ?? []).includes(tag.attributeId)) : allTags;
  return <DataTableRow>
    <DataTableCell as="th" scope="row" sizing="content"><DataTableRowAction aria-label={name} disabled={openDisabled} onClick={onOpen}>{name}</DataTableRowAction>{note && <DataTableNote>{note}</DataTableNote>}</DataTableCell>
    {attributeIds !== undefined ? (definitions ?? []).filter(definition => (attributeIds ?? []).includes(definition.id)).map(definition => {
      const tag = allTags.find(item => item.attributeId === definition.id);
      return <DataTableCell key={definition.id}>{attributesLoading ? <DataTableNote>Загрузка атрибутов…</DataTableNote>
        : attributesError ? <><DataTableNote>Атрибуты недоступны</DataTableNote>{onRetryAttributes && <DataTableControl><IconButton icon="undo" size="small" variant="secondary" title={`Повторить загрузку атрибутов ${name}`} ariaLabel={`Повторить загрузку атрибутов ${name}`} onClick={onRetryAttributes} /></DataTableControl>}</>
          : tag ? tag.values.join('; ') : definitions ? '—' : null}</DataTableCell>;
    }) :
    <DataTableCell>
      {attributesLoading ? <DataTableNote>Загрузка атрибутов…</DataTableNote>
        : attributesError ? <><DataTableNote>Атрибуты недоступны</DataTableNote>{onRetryAttributes && <DataTableControl><IconButton icon="undo" size="small" variant="secondary" title={`Повторить загрузку атрибутов ${name}`} ariaLabel={`Повторить загрузку атрибутов ${name}`} onClick={onRetryAttributes} /></DataTableControl>}</>
          : tags.length ? <DataTableActions wrap>{tags.map(tag => <Badge key={tag.attributeId}>{`${tag.title}: ${tag.values.join('; ')}`}</Badge>)}</DataTableActions>
            : definitions && values ? '—' : null}
    </DataTableCell>
    }
    {quantity !== undefined && <DataTableCell sizing="control" independent>{quantity}</DataTableCell>}
    {selection !== undefined && <DataTableCell sizing="control" independent>{selection}</DataTableCell>}
  </DataTableRow>;
};

export default CatalogEntryTable;
