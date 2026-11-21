import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { JsonValue } from './types';
import { makeNode, type PresentationNode, type PresentationType } from './presentationModel';
import PresentationEditor from './PresentationEditor';

const choices: { type: PresentationType; label: string }[] = [
  { type: 'group', label: 'Группа' },
  { type: 'composite', label: 'Составной показатель' },
  { type: 'resource', label: 'Ресурс' },
  { type: 'stat-list', label: 'Список характеристик' },
];

const Harness: React.FC<{ onChange: (roots: PresentationNode[]) => void }> = ({ onChange }) => {
  const [roots, setRoots] = useState<PresentationNode[]>([]);
  return <PresentationEditor roots={roots} onChange={next => { onChange(next); setRoots(next); }} surface="card" />;
};

describe('PresentationEditor empty nodes', () => {
  it.each(choices)('opens and saves settings for an empty $label node', ({ type, label }) => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: label }));
    const node = screen.getByRole('article', { name: 'Компонент отображения' });
    fireEvent.click(within(node).getByRole('button', { name: 'Настройки компонента' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Пустой компонент' } });
    const selectedSize = type === 'composite' || type === 'resource' ? 'medium' : undefined;
    if (selectedSize) fireEvent.change(screen.getByLabelText('Размер'), { target: { value: selectedSize } });
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    const roots = onChange.mock.calls.at(-1)?.[0] as PresentationNode[];
    const expectedParams = { ...(makeNode(type).params as Record<string, JsonValue>), ...(selectedSize ? { size: selectedSize } : {}) };
    expect(roots[0]).toMatchObject({ kind: 'layout', title: 'Пустой компонент', children: [], params: expectedParams });
    fireEvent.click(screen.getByRole('button', { name: 'Настройки компонента' }));
    expect(screen.getByLabelText('Название')).toHaveValue('Пустой компонент');
    if (selectedSize) expect(screen.getByLabelText('Размер')).toHaveValue(selectedSize);
  });
});
