import type { BaseField, BaseFieldInput, VirtualField, VirtualFieldInput } from './types';
import { parseJson, stringifyJson } from './json';

export type FieldRow<T> = {
  rowKey: string;
  field: T;
  baseline?: T;
  missing: boolean;
  resetKey: number;
  validationError?: string;
};

export const projectBaseField = (field: BaseField): BaseFieldInput => ({
  id: field.id,
  key: field.key,
  title: field.title,
  description: field.description,
  valueType: field.valueType,
  value: field.value,
  options: field.options,
});

export const newBaseField = (): BaseFieldInput => ({ key: '', title: '', description: '', valueType: 'Integer', value: 0, options: [] });
export const newVirtualField = (): VirtualFieldInput => ({ key: '', title: '', description: '', resultType: 'Integer', formulaId: '', bindings: {} });
export const rowIsDirty = <T>(row: FieldRow<T>) => row.baseline === undefined || row.missing || stringifyJson(row.field) !== stringifyJson(row.baseline) || Boolean(row.validationError);
export const rowsAreDirty = <T>(rows: FieldRow<T>[]) => rows.some(rowIsDirty);

const clone = <T,>(value: T): T => parseJson(stringifyJson(value)) as T;
const newRow = <T,>(rowKey: string, field: T): FieldRow<T> => ({ rowKey, field, missing: false, resetKey: 0 });

export const baseRowsFrom = (fields: BaseField[], rowKeys: string[]) => fields.map((field, index) => {
  const projected = projectBaseField(field);
  return { ...newRow(rowKeys[index]!, clone(projected)), baseline: clone(projected) };
});

export const virtualRowsFrom = (fields: VirtualField[], rowKeys: string[]) => fields.map((field, index) => {
  const projected: VirtualFieldInput = { ...field, bindings: { ...field.bindings } };
  return { ...newRow(rowKeys[index]!, clone(projected)), baseline: clone(projected) };
});

export const reconcileRows = <T extends { id?: string; key: string }>(current: FieldRow<T>[], incoming: T[], pendingRowKey?: string) => {
  const matchedServerIds = new Set<string>();
  const rows = current.flatMap(row => {
    if (!row.field.id) return [row];
    const server = incoming.find(field => field.id === row.field.id);
    if (!server) return rowIsDirty(row) ? [{ ...row, missing: true }] : [];
    matchedServerIds.add(server.id!);
    return rowIsDirty(row)
      ? [{ ...row, baseline: clone(server), missing: false }]
      : [{ ...row, field: clone(server), baseline: clone(server), missing: false }];
  });
  const pending = pendingRowKey ? current.find(row => row.rowKey === pendingRowKey && !row.field.id) : undefined;
  const pendingServer = pending ? incoming.find(field => field.key === pending.field.key && !matchedServerIds.has(field.id!)) : undefined;
  if (pending && pendingServer) {
    const index = rows.findIndex(row => row.rowKey === pending.rowKey);
    if (index >= 0) {
      rows[index] = { ...rows[index], field: { ...pending.field, id: pendingServer.id }, baseline: clone(pendingServer), missing: false, resetKey: rows[index].resetKey + 1, validationError: undefined };
      matchedServerIds.add(pendingServer.id!);
    }
  }
  for (const field of incoming) {
    if (!matchedServerIds.has(field.id!)) {
      rows.push({ ...newRow(crypto.randomUUID(), clone(field)), baseline: clone(field) });
      matchedServerIds.add(field.id!);
    }
  }
  return rows;
};
