import React from 'react';
import { Badge, Button, DataTable, IconButton } from '@tdn/shared';
import type { ReactNode } from 'react';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';
import { catalogAttributeTags } from './catalogAttributeTags';
import styles from './CatalogEntryTable.module.css';

export type CatalogEntryTableProps = {
  children: ReactNode;
  label: string;
  showQuantity?: boolean;
  showSelection?: boolean;
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
};

export const CatalogEntryTable: React.FC<CatalogEntryTableProps> = ({ children, label, showQuantity = false, showSelection = false }) => <DataTable aria-label={label} minWidth="0" className={styles.table}>
  <thead><tr><th scope="col">Название</th><th scope="col">Атрибуты</th>{showQuantity && <th scope="col" className={styles.compact}>Количество</th>}{showSelection && <th scope="col" className={styles.compact}>Выбор</th>}</tr></thead>
  <tbody>{children}</tbody>
</DataTable>;

export const CatalogEntryTableRow: React.FC<CatalogEntryTableRowProps> = ({ name, onOpen, definitions, values, attributesLoading = false, attributesError, onRetryAttributes, quantity, selection, openDisabled = false, note }) => {
  const tags = definitions && values ? catalogAttributeTags(definitions, values) : [];
  return <tr className={styles.row}>
    <th scope="row" className={styles.name}><Button type="button" size="small" variant="ghost" aria-label={name} disabled={openDisabled} onClick={onOpen}>{name}</Button>{note && <small>{note}</small>}</th>
    <td className={styles.attributes}>
      {attributesLoading ? <span className={styles.message}>Загрузка атрибутов…</span>
        : attributesError ? <span className={styles.message}>Атрибуты недоступны{onRetryAttributes && <> <IconButton icon="undo" size="small" variant="secondary" title={`Повторить загрузку атрибутов ${name}`} ariaLabel={`Повторить загрузку атрибутов ${name}`} onClick={onRetryAttributes} /></>}</span>
          : tags.length ? tags.map(tag => <Badge key={tag.attributeId}>{`${tag.title}: ${tag.values.join('; ')}`}</Badge>)
            : definitions && values ? '—' : null}
    </td>
    {quantity !== undefined && <td className={styles.compact}>{quantity}</td>}
    {selection !== undefined && <td className={styles.compact}>{selection}</td>}
  </tr>;
};

export default CatalogEntryTable;
