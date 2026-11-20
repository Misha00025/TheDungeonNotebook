import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, SearchBar, Select, StatePanel } from '@tdn/shared';
import type { ComputedSheet, FieldReference, JsonValue } from './types';
import { displayValue } from './json';
import { diagnosticMessage } from './displayDiagnostics';
import styles from './CharacterStatsTable.module.css';

type Filter = 'all' | 'base' | 'virtual' | 'errors';
type Row = { kind: 'Base'; id: string; label: string; value: React.ReactNode } | { kind: 'Virtual'; id: string; label: string; value: React.ReactNode };
type Props = {
  sheet: ComputedSheet;
  renderValue?: (reference: FieldReference, label: string, display?: React.ReactNode) => React.ReactNode;
  onVisibleFieldsChange: (ids: string[]) => void;
};

const labelOf = (field: { title: string; key: string }) => field.title || field.key;
const baseDisplay = (field: ComputedSheet['baseFields'][number], value: JsonValue) => {
  if (field.valueType === 'Boolean' && typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (field.valueType === 'SingleChoice') {
    if (value === '') return "''";
    return field.options.find(option => option.optionKey === value)?.title ?? 'Неизвестный вариант';
  }
  if (field.valueType === 'MultiChoice' && Array.isArray(value)) {
    if (value.length === 0) return 'Не выбрано';
    return value.map(item => field.options.find(option => option.optionKey === item)?.title ?? 'Неизвестный вариант').join(', ');
  }
  return value === '' ? "''" : displayValue(value);
};

const CharacterStatsTable: React.FC<Props> = ({ sheet, renderValue, onVisibleFieldsChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const rows = useMemo<Row[]>(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    const matches = (field: { title: string; key: string }) => !term || labelOf(field).toLocaleLowerCase().includes(term);
    const base: Row[] = filter === 'virtual' || filter === 'errors' ? [] : sheet.baseFields.filter(matches).map(field => ({
      kind: 'Base', id: field.id, label: labelOf(field), value: baseDisplay(field, field.effectiveValue),
    }));
    const virtual: Row[] = filter === 'base' ? [] : sheet.virtualFields.filter(field => (filter !== 'errors' || Boolean(field.diagnostic)) && matches(field)).map(field => ({
      kind: 'Virtual', id: field.id, label: labelOf(field), value: field.diagnostic ? diagnosticMessage(field.diagnostic.code) : displayValue(field.value),
    }));
    return [...base, ...virtual];
  }, [sheet, searchTerm, filter]);
  const visibleBaseIds = useMemo(() => rows.flatMap(row => row.kind === 'Base' ? [row.id] : []), [rows]);
  useEffect(() => { onVisibleFieldsChange(visibleBaseIds); }, [onVisibleFieldsChange, visibleBaseIds]);
  const hasFields = sheet.baseFields.length > 0 || sheet.virtualFields.length > 0;

  return <section className={styles.section} aria-label="Все характеристики">
    <div className={styles.toolbar}>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} aria-label="Поиск характеристик" />
      <Select aria-label="Фильтр характеристик" value={filter} onChange={event => setFilter(event.target.value as Filter)}>
        <option value="all">Все</option><option value="base">Базовые</option><option value="virtual">Вычисляемые</option><option value="errors">С ошибками расчёта</option>
      </Select>
    </div>
    {!hasFields ? <StatePanel kind="empty" title="Характеристики">Для персонажа пока нет характеристик.</StatePanel>
      : rows.length === 0 ? <StatePanel kind="empty" title="Характеристики не найдены">Измените поиск или фильтр.</StatePanel>
        : <DataTable aria-label="Все характеристики" minWidth="30rem" className={styles.table} wrapperClassName={styles.tableWrapper}>
          <colgroup><col className={styles.nameColumn} /><col className={styles.kindColumn} /><col /></colgroup>
          <thead><tr><th scope="col">Характеристика</th><th scope="col">Вид</th><th scope="col">Значение</th></tr></thead>
          <tbody>{rows.map(row => <tr key={`${row.kind}:${row.id}`}>
            <th scope="row" className={styles.name}>{row.label}</th>
            <td>{row.kind === 'Base' ? 'Базовая' : 'Вычисляемая'}</td>
            <td className={styles.value}>{row.kind === 'Base' ? renderValue?.({ kind: 'Base', fieldId: row.id }, row.label, row.value) ?? row.value : row.value}</td>
          </tr>)}</tbody>
        </DataTable>}
  </section>;
};

export default CharacterStatsTable;
