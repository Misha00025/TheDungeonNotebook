import React, { useState } from 'react';
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import type { PresentationNode } from './presentationModel';
import PresentationEditor from './PresentationEditor';
import PresentationRenderer from './PresentationRenderer';

const roots = (): PresentationNode[] => [{
  kind: 'layout', nodeKey: 'group', title: 'Группа', children: [{ kind: 'layout', nodeKey: 'child', title: 'Дочерний', params: {}, children: [] }],
  params: { version: 1, type: 'group', direction: 'column', columns: 3, gap: 'medium', appearance: 'plain', opaque: { keep: true } },
}];

const EditorHarness: React.FC<{ onChange: (nodes: PresentationNode[]) => void }> = ({ onChange }) => {
  const [nodes, setNodes] = useState(roots);
  return <PresentationEditor roots={nodes} surface="header" onChange={next => { onChange(next); setNodes(next); }} />;
};

describe('presentation group direction contracts', () => {
  it('retains direction, columns, opaque params, and children through editor changes', () => {
    const onChange = vi.fn();
    render(<EditorHarness onChange={onChange} />);
    const open = () => {
      const parent = screen.getByRole('article', { name: 'Группа' });
      fireEvent.click(within(parent).getAllByRole('button', { name: 'Настройки компонента' })[0]);
      return screen.getByLabelText('Направление');
    };
    const close = () => fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(screen.getByRole('article', { name: 'Группа' })).toBeInTheDocument();
    open();
    expect(screen.getByRole('option', { name: 'По колонкам' })).toHaveValue('column');
    fireEvent.change(screen.getByLabelText('Колонки'), { target: { value: '4' } });
    close();
    let changed = onChange.mock.calls[0]?.[0] as PresentationNode[];
    expect(changed[0]).toMatchObject({ nodeKey: 'group', children: roots()[0].children, params: { direction: 'column', columns: 4, opaque: { keep: true } } });

    fireEvent.change(open(), { target: { value: 'row' } });
    close();
    changed = onChange.mock.calls[1]?.[0] as PresentationNode[];
    expect(changed[0].params).toMatchObject({ direction: 'row', columns: 4, opaque: { keep: true } });

    fireEvent.change(open(), { target: { value: 'column' } });
    close();
    open();
    expect(screen.getByLabelText('Направление')).toHaveValue('column');
    expect(screen.getByLabelText('Колонки')).toHaveValue('4');
    close();
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['row', 4, 'before'],
    ['column', 3, 'after'],
    ['column', 1, 'before'],
  ] as const)('uses the actual drop axis for %s direction with %i columns', (direction, columns, placement) => {
    const leaf = (nodeKey: string): PresentationNode => ({ kind: 'layout', nodeKey, title: nodeKey, params: {}, children: [] });
    const group: PresentationNode = {
      kind: 'layout', nodeKey: 'group', title: 'Группа', children: [leaf('first'), leaf('target')],
      params: { version: 1, type: 'group', direction, columns, gap: 'medium', appearance: 'plain' },
    };
    const onDropNode = vi.fn();
    render(<PresentationRenderer roots={[group]} surface="header" onDropNode={onDropNode} />);
    const target = screen.getByRole('article', { name: 'target' });
    target.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) });
    const event = createEvent.drop(target);
    Object.defineProperties(event, {
      clientX: { value: 80 }, clientY: { value: 20 },
      dataTransfer: { value: { types: ['application/x-tdn-presentation'] } },
    });
    fireEvent(target, event);
    expect(onDropNode).toHaveBeenCalledWith('target', placement, expect.anything());
  });
});
