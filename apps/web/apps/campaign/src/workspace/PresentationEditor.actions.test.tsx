import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LosslessNumber } from 'lossless-json';
import type { ComputedSheet, JsonValue } from './types';
import type { PresentationNode, PresentationType } from './presentationModel';
import { makeNode } from './presentationModel';
import PresentationEditor from './PresentationEditor';
import PresentationRenderer from './PresentationRenderer';

const reference = { kind: 'Base' as const, fieldId: 'field-reference-1', future: 'retained' };
const node = (type: PresentationType, nodeKey: string, title: string, children: PresentationNode[] = [], extra: Record<string, JsonValue> = {}): PresentationNode => {
  const base = makeNode(type, title);
  return { ...base, nodeKey, children, params: { ...(base.params as Record<string, JsonValue>), ...extra } };
};
const group = (key: string, title: string, children: PresentationNode[] = []) => node('group', key, title, children, { futureData: { exact: new LosslessNumber('9007199254740993'), token: 'untouched' } });
const composite = (key: string, title: string) => node('composite', key, title, [], {
  parts: [{ source: reference, signed: true }, { text: ' HP' }],
  primary: reference,
  opaqueInteger: new LosslessNumber('9007199254740995'),
});

const Harness: React.FC<{ initialRoots: PresentationNode[]; disabled?: boolean; sheet?: ComputedSheet; onRootsChange?: (roots: PresentationNode[]) => void }> = ({ initialRoots, disabled = false, sheet, onRootsChange = () => undefined }) => {
  const [roots, setRoots] = useState(initialRoots);
  return <PresentationEditor roots={roots} onChange={next => { onRootsChange(next); setRoots(next); }} disabled={disabled} sheet={sheet} />;
};

const actionGroup = (article: HTMLElement) => within(article).getByRole('group', { name: 'Действия компонента' });
const action = (article: HTMLElement, name: string) => within(actionGroup(article)).getByRole('button', { name });
const article = (name: string) => screen.getByRole('article', { name });
const allKeys = (nodes: PresentationNode[]): string[] => nodes.flatMap(item => [item.nodeKey, ...allKeys(item.children)]);

describe('PresentationEditor inline actions and settings', () => {
  it('shows four palette choices and five actions only inside the selected node; selection alone does not open settings', () => {
    const root = group('root-a', 'Первая группа');
    render(<Harness initialRoots={[root]} />);

    expect(screen.getByRole('group', { name: 'Компоненты' }).querySelectorAll('button')).toHaveLength(4);
    const palette = screen.getByRole('group', { name: 'Компоненты' });
    for (const name of ['Группа', 'Составной показатель', 'Ресурс', 'Список характеристик']) expect(within(palette).getByRole('button', { name })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Свойства' })).not.toBeInTheDocument();
    expect(screen.queryByText('Переместить в группу')).not.toBeInTheDocument();
    expect(screen.queryByText('В корень')).not.toBeInTheDocument();
    expect(screen.queryByText('Выбрать родителя')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Действия компонента' })).not.toBeInTheDocument();

    fireEvent.click(article('Первая группа'));
    const selectedArticle = article('Первая группа');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const controls = actionGroup(selectedArticle);
    expect(within(controls).getAllByRole('button')).toHaveLength(5);
    for (const name of ['Переместить выше', 'Переместить ниже', 'Дублировать', 'Удалить', 'Настройки компонента']) {
      expect(action(selectedArticle, name)).toHaveAttribute('title', name);
    }
    fireEvent.click(action(selectedArticle, 'Настройки компонента'));
    expect(screen.getByRole('dialog', { name: 'Настройки компонента' })).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('Первая группа');
  });

  it('keeps title and group settings in the modal draft until one close commit, then reopens from updated roots', () => {
    const first = group('root-a', 'Первая группа');
    const second = group('root-b', 'Вторая группа');
    const originalRoots = [first, second];
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={originalRoots} onRootsChange={onRootsChange} />);

    fireEvent.click(article('Первая группа'));
    fireEvent.click(action(article('Первая группа'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Переименованная' } });
    fireEvent.change(screen.getByLabelText('Направление'), { target: { value: 'row' } });
    fireEvent.change(screen.getByLabelText('Интервал'), { target: { value: 'large' } });
    fireEvent.change(screen.getByLabelText('Колонки'), { target: { value: '3' } });
    expect(onRootsChange).not.toHaveBeenCalled();
    expect(article('Первая группа')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Переименованная' })).not.toBeInTheDocument();
    expect(originalRoots[0].title).toBe('Первая группа');
    expect((originalRoots[0].params as Record<string, JsonValue>).direction).toBe('column');
    expect(screen.getByLabelText('Направление')).toHaveValue('row');
    expect(screen.getByLabelText('Интервал')).toHaveValue('large');
    expect(screen.getByLabelText('Колонки')).toHaveValue('3');

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onRootsChange).toHaveBeenCalledTimes(1);
    const changedRoots = onRootsChange.mock.calls[0]?.[0] as PresentationNode[];
    expect(changedRoots[0]).toMatchObject({ nodeKey: first.nodeKey, kind: first.kind, title: 'Переименованная', children: first.children });
    expect(changedRoots[0].params).toMatchObject({ direction: 'row', gap: 'large', columns: 3 });
    expect((changedRoots[0].params as Record<string, JsonValue>).futureData).toEqual((first.params as Record<string, JsonValue>).futureData);
    const futureData = (changedRoots[0].params as Record<string, JsonValue>).futureData as Record<string, JsonValue>;
    expect(futureData.exact).toEqual(new LosslessNumber('9007199254740993'));
    expect(originalRoots).toEqual([first, second]);

    fireEvent.click(article('Переименованная'));
    fireEvent.click(action(article('Переименованная'), 'Настройки компонента'));
    expect(screen.getByLabelText('Название')).toHaveValue('Переименованная');
    expect(screen.getByLabelText('Направление')).toHaveValue('row');
    expect(screen.getByLabelText('Интервал')).toHaveValue('large');
    expect(screen.getByLabelText('Колонки')).toHaveValue('3');
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onRootsChange).toHaveBeenCalledTimes(1);

    fireEvent.click(article('Вторая группа'));
    fireEvent.click(action(article('Вторая группа'), 'Настройки компонента'));
    expect(screen.getByLabelText('Название')).toHaveValue('Вторая группа');
  });

  it.each(['Close button', 'native cancel/Escape'] as const)('commits settings once on %s, including repeated close events', closeMethod => {
    const root = group('close-root', 'До закрытия');
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[root]} onRootsChange={onRootsChange} />);
    fireEvent.click(article('До закрытия'));
    fireEvent.click(action(article('До закрытия'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'После закрытия' } });
    expect(onRootsChange).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    const cancel = () => dialog.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));

    act(() => {
      if (closeMethod === 'Close button') within(dialog).getByRole('button', { name: 'Закрыть' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      else cancel();
      cancel();
    });

    expect(onRootsChange).toHaveBeenCalledTimes(1);
    expect((onRootsChange.mock.calls[0]?.[0] as PresentationNode[])[0].title).toBe('После закрытия');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('defers composite parts, source references, primary selection, and resource maximum until close', () => {
    const fieldA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const fieldB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const refA = { kind: 'Base' as const, fieldId: fieldA };
    const refB = { kind: 'Base' as const, fieldId: fieldB };
    const sheet: ComputedSheet = {
      contentRevision: 1,
      templateContentRevision: 1,
      description: '',
      baseFields: [
        { id: fieldA, key: 'first', title: 'Первый источник', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 7, isExplicit: true },
        { id: fieldB, key: 'second', title: 'Второй источник', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: new LosslessNumber('9007199254740993'), isExplicit: true },
      ],
      virtualFields: [],
      formulaContentRevisions: [],
    };
    const compositeRoot = node('composite', 'composite-root', 'Составной', [], { parts: [{ source: refA }, { text: ' / ' }, { source: refA }], primary: refA, opaque: new LosslessNumber('9007199254740995') });
    const resourceRoot = node('resource', 'resource-root', 'Ресурс', [], { current: refA, maximum: refB, showBar: false, opaque: 'keep' });
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[compositeRoot, resourceRoot]} sheet={sheet} onRootsChange={onRootsChange} />);

    fireEvent.click(article('Составной'));
    fireEvent.click(action(article('Составной'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Характеристика, часть 1'), { target: { value: `Base:${encodeURIComponent(fieldB)}` } });
    fireEvent.change(screen.getByLabelText('Текст, часть 2'), { target: { value: ' + ' } });
    fireEvent.change(screen.getByLabelText('Основное значение'), { target: { value: `Base:${encodeURIComponent(fieldB)}` } });
    expect(onRootsChange).not.toHaveBeenCalled();
    expect(article('Составной')).toHaveTextContent('7 / 7');
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(onRootsChange).toHaveBeenCalledTimes(1);
    const compositeUpdatedRoots = onRootsChange.mock.calls[0]?.[0] as PresentationNode[];
    expect(compositeUpdatedRoots[0].nodeKey).toBe(compositeRoot.nodeKey);
    expect(compositeUpdatedRoots[0].params).toMatchObject({ parts: [{ source: refB }, { text: ' + ' }, { source: refA }], primary: refB, opaque: new LosslessNumber('9007199254740995') });
    expect(article('Составной')).toHaveTextContent(/9007199254740993\s*\+\s*7/);

    fireEvent.click(article('Ресурс'));
    fireEvent.click(action(article('Ресурс'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Максимум'), { target: { value: `Base:${encodeURIComponent(fieldA)}` } });
    expect(onRootsChange).toHaveBeenCalledTimes(1);
    expect(article('Ресурс')).toHaveTextContent(/7\s*\/\s*9007199254740993/);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(onRootsChange).toHaveBeenCalledTimes(2);
    const resourceUpdatedRoots = onRootsChange.mock.calls[1]?.[0] as PresentationNode[];
    expect(resourceUpdatedRoots[0]).toEqual(compositeUpdatedRoots[0]);
    expect(resourceUpdatedRoots[1].nodeKey).toBe(resourceRoot.nodeKey);
    expect(resourceUpdatedRoots[1].params).toMatchObject({ current: refA, maximum: refA, showBar: false, opaque: 'keep' });
    expect(article('Ресурс')).toHaveTextContent('7/7');
  });

  it('closes settings without applying or substituting when its selected node disappears', () => {
    const roots = [group('selected', 'Выбранный'), group('remaining', 'Оставшийся')];
    const onRootsChange = vi.fn();
    const RemovingHarness: React.FC = () => {
      const [current, setCurrent] = useState(roots);
      return <><button type="button" onClick={() => setCurrent([roots[1]])}>Remove selected externally</button><PresentationEditor roots={current} onChange={next => { onRootsChange(next); setCurrent(next); }} /></>;
    };
    render(<RemovingHarness />);

    fireEvent.click(article('Выбранный'));
    fireEvent.click(action(article('Выбранный'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Черновое имя' } });
    expect(onRootsChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Название')).toHaveValue('Черновое имя');
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected externally' }));
    expect(onRootsChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Черновое имя')).not.toBeInTheDocument();
    expect(article('Оставшийся')).toBeInTheDocument();
  });

  it('applies modal title and params to current node data without restoring stale children', () => {
    const root = group('external-root', 'До обновления');
    const currentChild = composite('new-child', 'Актуальный ребёнок');
    const onRootsChange = vi.fn();
    const { rerender } = render(<PresentationEditor roots={[root]} onChange={onRootsChange} />);
    fireEvent.click(article('До обновления'));
    fireEvent.click(action(article('До обновления'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Черновое название' } });
    fireEvent.change(screen.getByLabelText('Направление'), { target: { value: 'row' } });
    expect(onRootsChange).not.toHaveBeenCalled();

    const externallyUpdated = { ...root, children: [currentChild] };
    rerender(<PresentationEditor roots={[externallyUpdated]} onChange={onRootsChange} />);
    expect(article('До обновления')).toBeInTheDocument();
    expect(article('Актуальный ребёнок')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(onRootsChange).toHaveBeenCalledTimes(1);
    const result = onRootsChange.mock.calls[0]?.[0] as PresentationNode[];
    expect(result[0].title).toBe('Черновое название');
    expect(result[0].params).toMatchObject({ direction: 'row' });
    expect(result[0].children).toEqual([currentChild]);
    expect(result[0].nodeKey).toBe(root.nodeKey);
  });

  it('moves root siblings within the root list and preserves each node payload', () => {
    const roots = [composite('root-a', 'A'), group('root-b', 'B'), composite('root-c', 'C')];
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={roots} onRootsChange={onRootsChange} />);

    fireEvent.click(article('A'));
    expect(action(article('A'), 'Переместить выше')).toBeDisabled();
    fireEvent.click(article('C'));
    expect(action(article('C'), 'Переместить ниже')).toBeDisabled();
    fireEvent.click(action(article('C'), 'Переместить выше'));
    expect(screen.getAllByRole('article').map(item => item.getAttribute('aria-label'))).toEqual(['A', 'C', 'B']);
    fireEvent.click(action(article('C'), 'Переместить выше'));
    expect(screen.getAllByRole('article').map(item => item.getAttribute('aria-label'))).toEqual(['C', 'A', 'B']);
    fireEvent.click(action(article('C'), 'Переместить ниже'));
    expect(screen.getAllByRole('article').map(item => item.getAttribute('aria-label'))).toEqual(['A', 'C', 'B']);
    expect(onRootsChange.mock.calls.at(-1)?.[0]).toEqual([roots[0], roots[2], roots[1]]);
  });

  it('moves a nested child only among siblings and its actions do not select its parent', () => {
    const childA = composite('child-a', 'Дочерний A');
    const childB = composite('child-b', 'Дочерний B');
    const parent = group('parent', 'Родитель', [childA, childB]);
    const other = group('other', 'Другая группа', [composite('other-child', 'Другой ребёнок')]);
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[parent, other]} onRootsChange={onRootsChange} />);

    fireEvent.click(article('Дочерний B'));
    fireEvent.click(action(article('Дочерний B'), 'Переместить выше'));
    expect(within(article('Родитель')).getAllByRole('article').map(item => item.getAttribute('aria-label'))).toEqual(['Дочерний B', 'Дочерний A']);
    const latest = onRootsChange.mock.calls.at(-1)?.[0] as PresentationNode[];
    expect(latest.map(item => item.nodeKey)).toEqual(['parent', 'other']);
    expect(latest[0].children).toEqual([childB, childA]);
    expect(latest[1]).toEqual(other);

    fireEvent.click(action(article('Дочерний B'), 'Настройки компонента'));
    expect(screen.getByLabelText('Название')).toHaveValue('Дочерний B');
  });

  it('duplicates a group with opaque values and descendants while remapping every cloned key', () => {
    const child = composite('source-child', 'Показатель');
    const original = group('source-group', 'Исходная', [child]);
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[original]} onRootsChange={onRootsChange} />);

    fireEvent.click(article('Исходная'));
    fireEvent.click(action(article('Исходная'), 'Дублировать'));
    const roots = onRootsChange.mock.calls.at(-1)?.[0] as PresentationNode[];
    const clone = roots[1];
    expect(roots[0]).toEqual(original);
    expect(allKeys(roots)).toHaveLength(new Set(allKeys(roots)).size);
    expect(clone.title).toBe(original.title);
    expect(clone.params).toEqual(original.params);
    expect(clone.children).toHaveLength(1);
    expect(clone.children[0].title).toBe(child.title);
    expect(clone.children[0].params).toEqual(child.params);
    expect(clone.children[0].params).toMatchObject({ parts: [{ source: reference, signed: true }, { text: ' HP' }], primary: reference, opaqueInteger: new LosslessNumber('9007199254740995') });
    expect(clone.params).toMatchObject({ futureData: { exact: new LosslessNumber('9007199254740993'), token: 'untouched' } });
    expect(clone.nodeKey).not.toBe(original.nodeKey);
    expect(clone.children[0].nodeKey).not.toBe(child.nodeKey);
  });

  it('deletes a child without group confirmation and selects its parent after the final child is removed', () => {
    const parent = group('parent', 'Родитель', [composite('child', 'Ребёнок')]);
    const confirm = vi.spyOn(window, 'confirm');
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[parent]} onRootsChange={onRootsChange} />);

    fireEvent.click(article('Ребёнок'));
    fireEvent.click(action(article('Ребёнок'), 'Удалить'));
    expect(confirm).not.toHaveBeenCalled();
    expect(onRootsChange).toHaveBeenCalledTimes(1);
    expect((onRootsChange.mock.calls[0]?.[0] as PresentationNode[])[0].children).toEqual([]);
    expect(action(article('Родитель'), 'Настройки компонента')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('cancels group deletion without changes or removes only its subtree after confirmation', () => {
    const nested = group('nested', 'Вложенная', [composite('nested-child', 'Внутренний')]);
    const root = group('root', 'Удаляемая', [nested]);
    const sibling = group('sibling', 'Сосед');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[root, sibling]} onRootsChange={onRootsChange} />);

    fireEvent.click(article('Удаляемая'));
    fireEvent.click(action(article('Удаляемая'), 'Удалить'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onRootsChange).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(action(article('Удаляемая'), 'Удалить'));
    expect(onRootsChange).toHaveBeenCalledTimes(1);
    expect(onRootsChange.mock.calls[0]?.[0]).toEqual([sibling]);
    expect(screen.getByRole('article', { name: 'Сосед' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('keeps settings readonly when disabled and prevents move or destructive commands', () => {
    const roots = [group('root-a', 'A'), group('root-b', 'B')];
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={roots} disabled onRootsChange={onRootsChange} />);
    fireEvent.click(article('A'));

    expect(action(article('A'), 'Переместить выше')).toBeDisabled();
    expect(action(article('A'), 'Дублировать')).toBeDisabled();
    expect(action(article('A'), 'Удалить')).toBeDisabled();
    fireEvent.click(action(article('A'), 'Дублировать'));
    fireEvent.click(action(article('A'), 'Удалить'));
    expect(onRootsChange).not.toHaveBeenCalled();

    fireEvent.click(action(article('A'), 'Настройки компонента'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toBeDisabled();
    expect(screen.getByLabelText('Направление')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Не изменено' } });
    expect(onRootsChange).not.toHaveBeenCalled();
  });

  it('does not apply an open settings draft if the editor becomes disabled before closing', () => {
    const root = group('transition-root', 'Исходное');
    const onRootsChange = vi.fn();
    const { rerender } = render(<Harness initialRoots={[root]} onRootsChange={onRootsChange} />);
    fireEvent.click(article('Исходное'));
    fireEvent.click(action(article('Исходное'), 'Настройки компонента'));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Не применять' } });
    expect(onRootsChange).not.toHaveBeenCalled();

    rerender(<Harness initialRoots={[root]} disabled onRootsChange={onRootsChange} />);
    expect(screen.getByLabelText('Название')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onRootsChange).not.toHaveBeenCalled();
    expect(article('Исходное')).toBeInTheDocument();
  });

  it('hides editor controls and settings in preview and never renders actions without a callback at runtime', () => {
    const root = group('root', 'Предпросмотр');
    const onRootsChange = vi.fn();
    const { rerender } = render(<Harness initialRoots={[root]} onRootsChange={onRootsChange} />);
    fireEvent.click(article('Предпросмотр'));
    fireEvent.click(action(article('Предпросмотр'), 'Настройки компонента'));
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр' }));
    expect(screen.queryByRole('group', { name: 'Компоненты' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Действия компонента' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onRootsChange).not.toHaveBeenCalled();

    rerender(<PresentationRenderer roots={[root]} />);
    expect(screen.queryByRole('group', { name: 'Действия компонента' })).not.toBeInTheDocument();
  });

  it('preserves nested drag and drop, and action-control dragstart is cancelled without a node payload', () => {
    const child = composite('drag-child', 'Перетаскиваемый');
    const firstGroup = group('first-group', 'Первая', [child]);
    const secondGroup = group('second-group', 'Вторая');
    const onRootsChange = vi.fn();
    render(<Harness initialRoots={[firstGroup, secondGroup]} onRootsChange={onRootsChange} />);

    const payload = new Map<string, string>();
    const dataTransfer = { setData: vi.fn((type: string, value: string) => payload.set(type, value)), getData: vi.fn((type: string) => payload.get(type) ?? '') };
    fireEvent.dragStart(article('Перетаскиваемый'), { dataTransfer });
    const targetInside = screen.getAllByText('Внутрь')[1];
    fireEvent.dragOver(targetInside);
    fireEvent.drop(targetInside, { dataTransfer });
    const moved = onRootsChange.mock.calls.at(-1)?.[0] as PresentationNode[];
    expect(moved.map(item => item.nodeKey)).toEqual(['first-group', 'second-group']);
    expect(moved[0].children).toEqual([]);
    expect(moved[1].children.map(item => item.nodeKey)).toEqual(['drag-child']);

    fireEvent.click(article('Перетаскиваемый'));
    const actionPayload = new Map<string, string>();
    const actionTransfer = { setData: vi.fn((type: string, value: string) => actionPayload.set(type, value)), getData: vi.fn((type: string) => actionPayload.get(type) ?? '') };
    const actionButton = action(article('Перетаскиваемый'), 'Настройки компонента');
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, 'dataTransfer', { value: actionTransfer });
    actionButton.dispatchEvent(dragStart);
    expect(dragStart.defaultPrevented).toBe(true);
    expect(actionTransfer.setData).not.toHaveBeenCalled();
    expect(actionPayload.has('application/x-tdn-presentation')).toBe(false);
    expect(within(article('Перетаскиваемый')).queryByRole('group', { name: 'Действия компонента' })).toBeInTheDocument();
    fireEvent.click(actionButton);
    expect(screen.getByLabelText('Название')).toHaveValue('Перетаскиваемый');
  });
});
