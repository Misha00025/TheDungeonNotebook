import { describe, expect, it } from 'vitest';
import type { BaseField } from './types';
import { acceptRows, baseRowsFrom, newBaseField, newVirtualField, projectBaseField, reconcileRows, rowIsDirty, rowsAreDirty, virtualRowsFrom } from './templateFieldRows';

const savedBase: BaseField = { id: 'base-1', key: 'base', title: 'Base', description: '', valueType: 'Number', typeRevision: 4, value: 2, options: [] };

describe('template field rows', () => {
  it('projects saved base fields without type revision and includes ids in the saved projection', () => {
    expect(projectBaseField(savedBase)).toEqual({ id: 'base-1', key: 'base', title: 'Base', description: '', valueType: 'Number', value: 2, options: [] });
    expect(projectBaseField(savedBase)).not.toHaveProperty('typeRevision');
  });

  it('uses the agreed defaults and treats new, changed, missing, or invalid rows as dirty', () => {
    expect(newBaseField()).toEqual({ key: '', title: '', description: '', valueType: 'Integer', value: 0, options: [] });
    expect(newVirtualField()).toEqual({ key: '', title: '', description: '', resultType: 'Integer', formulaId: '', bindings: {} });
    const [clean] = baseRowsFrom([savedBase], ['clean']);
    expect(rowIsDirty(clean)).toBe(false);
    expect(rowIsDirty({ ...clean, field: { ...clean.field, title: 'Changed' } })).toBe(true);
    expect(rowIsDirty({ ...clean, validationError: 'Invalid number' })).toBe(true);
    expect(rowIsDirty({ ...clean, missing: true })).toBe(true);
    expect(rowIsDirty({ ...clean, deleted: true })).toBe(true);
    expect(rowsAreDirty([...virtualRowsFrom([], []), { rowKey: 'new', field: newVirtualField(), missing: false, resetKey: 0 }])).toBe(true);
  });

  it('rebases by saved id, retains dirty rows, drops clean missing rows, and appends server additions', () => {
    const [clean, dirty] = baseRowsFrom([savedBase, { ...savedBase, id: 'base-2', key: 'second' }], ['clean', 'dirty']);
    const rows = reconcileRows([
      clean,
      { ...dirty, field: { ...dirty.field, title: 'Local' } },
      { rowKey: 'new', field: newBaseField(), missing: false, resetKey: 0 },
    ], [
      { ...savedBase, title: 'Server' },
      { ...savedBase, id: 'base-3', key: 'third' },
    ]);
    expect(rows.find(row => row.rowKey === clean.rowKey)?.field.title).toBe('Server');
    expect(rows.find(row => row.rowKey === dirty.rowKey)).toMatchObject({ field: { title: 'Local' }, baseline: { title: 'Base' }, missing: true });
    expect(rows.find(row => row.rowKey === 'new')).toBeDefined();
    expect(rows.some(row => row.field.id === 'base-3')).toBe(true);
  });

  it('appends the complete initial server set with unique local row keys', () => {
    const incoming = [savedBase, { ...savedBase, id: 'base-2', key: 'second' }].map(projectBaseField);
    const rows = reconcileRows([], incoming);
    expect(rows.map(row => row.field.id)).toEqual(['base-1', 'base-2']);
    expect(new Set(rows.map(row => row.rowKey)).size).toBe(2);
    expect(rows.map(row => row.baseline)).toEqual(incoming);
    expect(rows.every(row => row.baseline !== undefined && !Object.prototype.hasOwnProperty.call(row.baseline, 'typeRevision'))).toBe(true);
  });

  it('associates an uncertain publication only with its pending row key', () => {
    const rows = [
      { rowKey: 'pending', field: { ...newBaseField(), key: 'same' }, missing: false, resetKey: 0 },
      { rowKey: 'other', field: { ...newBaseField(), key: 'same' }, missing: false, resetKey: 0 },
    ];
    const result = reconcileRows(rows, [{ ...newBaseField(), id: 'published', key: 'same' }], 'pending');
    expect(result.find(row => row.rowKey === 'pending')?.field.id).toBe('published');
    expect(result.find(row => row.rowKey === 'other')?.field.id).toBeUndefined();
  });

  it('accepts confirmed server rows while retaining row keys for server-assigned ids', () => {
    const draft = { rowKey: 'local', field: { ...newBaseField(), key: 'new', title: 'New' }, missing: false, resetKey: 3 };
    const accepted = acceptRows([draft], [{ ...newBaseField(), id: 'server-id', key: 'new', title: 'New' }]);
    expect(accepted).toEqual([expect.objectContaining({ rowKey: 'local', field: { ...newBaseField(), id: 'server-id', key: 'new', title: 'New' }, baseline: { ...newBaseField(), id: 'server-id', key: 'new', title: 'New' }, resetKey: 4, missing: false, deleted: false })]);
  });

  it('matches multiple pending publications without adopting unrelated same-key drafts', () => {
    const current = [
      { rowKey: 'one', field: { ...newBaseField(), key: 'one', title: 'One' }, missing: false, resetKey: 0 },
      { rowKey: 'two', field: { ...newBaseField(), key: 'two', title: 'Two' }, missing: false, resetKey: 0 },
      { rowKey: 'other', field: { ...newBaseField(), key: 'one', title: 'Unsubmitted duplicate key' }, missing: false, resetKey: 0 },
    ];
    const rows = reconcileRows(current, [
      { ...newBaseField(), id: 'server-1', key: 'one', title: 'One' },
      { ...newBaseField(), id: 'server-2', key: 'two', title: 'Two' },
    ], ['one', 'two']);
    expect(rows.find(row => row.rowKey === 'one')?.field.id).toBe('server-1');
    expect(rows.find(row => row.rowKey === 'two')?.field.id).toBe('server-2');
    expect(rows.find(row => row.rowKey === 'other')?.field).toMatchObject({ key: 'one', title: 'Unsubmitted duplicate key' });
    expect(rows.find(row => row.rowKey === 'other')?.field.id).toBeUndefined();
  });
});
