import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ViewTreeEditor from './ViewTreeEditor';
import type { ViewNode } from './types';
import { parseJson, stringifyJson } from './json';

const drafts = vi.hoisted(() => ({ values: {} as Record<string, boolean> }));
vi.mock('./Workspace', () => ({ useDirtyDraft: (owner: string, dirty: boolean) => { drafts.values[owner] = dirty; } }));

const initial: ViewNode[] = [{ kind: 'layout', nodeKey: 'root', title: 'Root', params: parseJson('{"direction":"row","future":9007199254740993}'), children: [{ kind: 'widget', nodeKey: 'widget', title: 'Widget', params: parseJson('{"opaque":9007199254740993}'), children: [{ kind: 'layout', nodeKey: 'inner', title: 'Inner', params: ['x', null], children: [] }], sources: [{ kind: 'Virtual', fieldId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }, { kind: 'Base', fieldId: 'dddddddd-dddd-dddd-dddd-dddddddddddd' }], format: '$1 ${4:s} <opaque>' }] }];

const Harness: React.FC<{ resetKey?: number; validity?: (valid: boolean) => void; onChange?: (roots: ViewNode[]) => void }> = ({ resetKey = 0, validity, onChange }) => {
  const [roots, setRoots] = useState(initial);
  return <ViewTreeEditor roots={roots} onChange={next => { setRoots(next); onChange?.(next); }} onValidityChange={validity} resetKey={resetKey} />;
};

describe('ViewTreeEditor', () => {
  beforeEach(() => { drafts.values = {}; });
  it('edits a nested tree while preserving opaque widget data and lossless params', () => {
    render(<Harness />);
    fireEvent.change(screen.getAllByLabelText('Заголовок')[0], { target: { value: 'Updated' } });
    fireEvent.change(screen.getAllByLabelText('Заголовок')[2], { target: { value: 'Changed inner' } });
    expect(screen.getByDisplayValue('$1 ${4:s} <opaque>')).toBeTruthy();
    expect(screen.queryByLabelText('Template ID')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Field ID').map(input => (input as HTMLInputElement).value)).toEqual(['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd']);
    expect(stringifyJson(initial[0].params)).toContain('9007199254740993');
  });

  it('preserves the latest parameter object when changing direction', () => {
    render(<Harness />);
    fireEvent.change(screen.getAllByLabelText('Параметры (JSON)')[0], { target: { value: '{"direction":"column","futureKey":9007199254740993}' } });
    fireEvent.change(screen.getAllByLabelText('Направление')[0], { target: { value: 'row' } });
    const text = (screen.getAllByLabelText('Параметры (JSON)')[0] as HTMLTextAreaElement).value;
    expect(text).toContain('futureKey');
    expect(text).toContain('9007199254740993');
  });

  it('keeps invalid raw params and reports invalidity until reset', () => {
    const validity = vi.fn();
    const { rerender } = render(<Harness resetKey={0} validity={validity} />);
    const params = screen.getAllByLabelText('Параметры (JSON)')[0];
    fireEvent.change(params, { target: { value: '{invalid' } });
    expect(screen.getByRole('alert').textContent).toContain('Некорректный JSON');
    expect(validity).toHaveBeenLastCalledWith(false);
    rerender(<Harness resetKey={1} validity={validity} />);
    expect((screen.getAllByLabelText('Параметры (JSON)')[0] as HTMLTextAreaElement).value).not.toBe('{invalid');
    expect(validity).toHaveBeenLastCalledWith(true);
    expect(Object.values(drafts.values).every(value => !value)).toBe(true);
  });

  it('requires confirmation before dropping widget fields and retains children', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness />);
    const widget = screen.getByLabelText('Узел Widget');
    const fields = within(widget).getByRole('group', { name: 'Поля узла Widget' });
    fireEvent.change(within(fields).getByLabelText('Тип'), { target: { value: 'layout' } });
    expect(confirm).toHaveBeenCalled();
    expect(within(fields).getByLabelText('Формат')).toBeTruthy();
    confirm.mockReturnValue(true);
    fireEvent.change(within(fields).getByLabelText('Тип'), { target: { value: 'layout' } });
    expect(within(fields).queryByLabelText('Формат')).toBeNull();
    expect(screen.getByLabelText('Узел Inner')).toBeTruthy();
    confirm.mockRestore();
  });

  it('serializes a converted layout without widget-only fields and keeps params and children', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const widget = screen.getByLabelText('Узел Widget');
    const fields = within(widget).getByRole('group', { name: 'Поля узла Widget' });
    fireEvent.change(within(fields).getByLabelText('Тип'), { target: { value: 'layout' } });
    const converted = onChange.mock.calls.at(-1)?.[0][0].children[0];
    expect(converted.kind).toBe('layout');
    expect(converted).not.toHaveProperty('sources');
    expect(converted).not.toHaveProperty('format');
    expect(converted.children[0].nodeKey).toBe('inner');
    expect(stringifyJson(converted.params)).toContain('9007199254740993');
    confirm.mockRestore();
  });

  it('does not expose direction quick-edit while raw params are invalid', () => {
    render(<Harness />);
    const rootFields = screen.getByRole('group', { name: 'Поля узла Root' });
    const params = within(rootFields).getByLabelText('Параметры (JSON)');
    expect(() => fireEvent.change(params, { target: { value: '{invalid' } })).not.toThrow();
    expect(within(rootFields).queryByLabelText('Направление')).toBeNull();
  });

  it('supports sibling insertion, source ordering and duplicate node-key validation', () => {
    const validity = vi.fn();
    const onChange = vi.fn();
    render(<Harness validity={validity} onChange={onChange} />);
    const widget = screen.getByLabelText('Узел Widget');
    fireEvent.click(within(within(widget).getByRole('group', { name: 'Источник 1' })).getByRole('button', { name: 'Источник 1: вниз' }));
    const firstSource = within(screen.getByRole('group', { name: 'Источник 1' }));
    expect((firstSource.getByLabelText('Field ID') as HTMLInputElement).value).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd');
    expect((firstSource.getByLabelText('Вид') as HTMLSelectElement).value).toBe('Base');
    fireEvent.change(firstSource.getByLabelText('Field ID'), { target: { value: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } });
    const ordered = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0][0].children[0].sources;
    expect(ordered).toEqual([{ kind: 'Base', fieldId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }, { kind: 'Virtual', fieldId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }]);
    fireEvent.click(within(screen.getByLabelText('Узел Widget')).getByRole('button', { name: 'Добавить источник' }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0][0].children[0].sources[2]).toEqual({ kind: 'Base', fieldId: '' });
    fireEvent.change(screen.getAllByLabelText('nodeKey')[2], { target: { value: 'root' } });
    expect(screen.getByText('nodeKey должен быть уникален во всём дереве.')).toBeTruthy();
    expect(validity).toHaveBeenLastCalledWith(false);
  });
});
