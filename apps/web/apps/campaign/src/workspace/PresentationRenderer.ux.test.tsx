import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { LosslessNumber } from 'lossless-json';
import type { ComputedSheet, FieldReference } from './types';
import { parseJson } from './json';
import type { PresentationNode } from './presentationModel';
import PresentationRenderer from './PresentationRenderer';

const firstId = '11111111-1111-4111-8111-111111111111';
const primaryId = '22222222-2222-4222-8222-222222222222';
const maximumId = '33333333-3333-4333-8333-333333333333';
const baseField = (id: string, title: string, valueType: 'Integer' | 'Number' | 'String' | 'Boolean', effectiveValue: ComputedSheet['baseFields'][number]['effectiveValue']) => ({ id, key: id, title, description: '', valueType, typeRevision: 1, options: [], effectiveValue, isExplicit: true });
const sheet: ComputedSheet = {
  contentRevision: 1,
  templateContentRevision: 1,
  description: '',
  baseFields: [baseField(firstId, 'Первый источник', 'Integer', 16), baseField(primaryId, 'Основной источник', 'Integer', 3), baseField(maximumId, 'Предел источника', 'Integer', 20), baseField('zero', 'Zero source', 'Integer', 0), baseField('false', 'False source', 'Boolean', false), baseField('empty', 'Empty source', 'String', ''), baseField('large', 'Large source', 'Integer', new LosslessNumber('9007199254740993'))],
  virtualFields: [{ id: 'broken', key: 'broken', title: 'Внутреннее имя ошибки', description: '', resultType: 'Integer', value: 0, diagnostic: { code: 'formula_error', message: 'bad' } }],
  formulaContentRevisions: [],
};
const node = (title: string, params: string, nodeKey = title): PresentationNode => ({ kind: 'layout', nodeKey, title, params: parseJson(params), children: [] });
const reference = (fieldId: string, kind = 'Base') => ({ kind, fieldId });

describe('PresentationRenderer UX contracts', () => {
  it('renders a composite as one whole-record trigger without field names or an extra primary row', () => {
    const root = node('Уровень защиты', JSON.stringify({ version: 1, type: 'composite', parts: [{ source: reference(firstId) }, { text: ' (' }, { source: reference(primaryId), signed: true }, { text: ')' }], primary: reference(primaryId) }));
    const onRenderValue = vi.fn((_ref: FieldReference, _label: string, display?: React.ReactNode) => <button type="button">{display}</button>);
    render(<PresentationRenderer roots={[root]} sheet={sheet} renderValue={onRenderValue} />);
    const article = screen.getByRole('article', { name: 'Уровень защиты' });
    expect(within(article).getByRole('heading', { name: 'Уровень защиты' })).toBeInTheDocument();
    const trigger = within(article).getByRole('button');
    expect(trigger).toHaveTextContent('16 (+3)');
    expect(within(article).getAllByRole('button')).toHaveLength(1);
    expect(article.textContent).toBe('Уровень защиты16 (+3)');
    expect(onRenderValue).toHaveBeenCalledWith({ kind: 'Base', fieldId: primaryId }, 'Основной источник', expect.anything());
    expect(screen.queryByText('Первый источник')).not.toBeInTheDocument();
    expect(screen.queryByText('Основной источник')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps sample and non-editable composites as text and preserves zero, false, empty, lossless, signed, and diagnostic parts', () => {
    const sampleRoot = node('Образец', JSON.stringify({ version: 1, type: 'composite', parts: [{ source: reference(primaryId) }], primary: reference(primaryId) }));
    const staticRoot = node('Значения', JSON.stringify({ version: 1, type: 'composite', parts: [
      { source: reference('zero') }, { text: '|' }, { source: reference('false') }, { text: '|' }, { source: reference('empty') }, { text: '|' },
      { source: reference('large'), signed: true }, { text: '|' }, { source: reference('broken', 'Virtual') },
    ], primary: null }));
    const callback = vi.fn(() => <button type="button">unexpected</button>);
    const { rerender } = render(<PresentationRenderer roots={[sampleRoot]} sheet={sheet} sample renderValue={callback} />);
    expect(document.body).toHaveTextContent('12Образец');
    expect(document.body).not.toHaveTextContent('3');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(callback).not.toHaveBeenCalled();
    rerender(<PresentationRenderer roots={[sampleRoot, staticRoot]} sheet={sheet} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent(/0\|false\|''\|\+9007199254740993\|Не удалось вычислить характеристику\./);
    expect(screen.queryByText('Внутреннее имя ошибки')).not.toBeInTheDocument();
  });

  it('renders resources as current / maximum, edits only current, and omits a dangling slash without maximum', () => {
    const resource = (maximum: string) => node('Запас сил', JSON.stringify({ version: 1, type: 'resource', current: reference(primaryId), maximum: maximum ? reference(maximum) : null, showBar: false }));
    const callback = vi.fn((_ref: FieldReference, _label: string, display?: React.ReactNode) => <button type="button">{display}</button>);
    const { rerender } = render(<PresentationRenderer roots={[resource(maximumId)]} sheet={sheet} renderValue={callback} />);
    expect(screen.getByRole('heading', { name: 'Запас сил' })).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('3');
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0]).toEqual({ kind: 'Base', fieldId: primaryId });
    expect(screen.queryByText('Основной источник')).not.toBeInTheDocument();
    expect(screen.queryByText('Предел источника')).not.toBeInTheDocument();
    rerender(<PresentationRenderer roots={[resource('')]} sheet={sheet} renderValue={callback} />);
    expect(screen.queryByText('/')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('3');
  });

  it('keeps stat-list labels and the existing two-argument callback contract', () => {
    const root = node('Характеристики', JSON.stringify({ version: 1, type: 'stat-list', columns: 1, entries: [{ source: reference(primaryId), label: 'Сила' }] }));
    const callback = vi.fn((_ref: FieldReference, _label: string) => <button type="button">3</button>);
    render(<PresentationRenderer roots={[root]} sheet={sheet} renderValue={callback} />);
    expect(screen.getByText('Сила')).toBeInTheDocument();
    expect(callback).toHaveBeenCalledWith({ kind: 'Base', fieldId: primaryId }, 'Сила');
  });
});
