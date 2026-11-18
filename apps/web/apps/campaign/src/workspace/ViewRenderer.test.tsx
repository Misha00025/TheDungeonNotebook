import React from 'react';
import { LosslessNumber } from 'lossless-json';
import { render, screen } from '@testing-library/react';
import { formatWidget } from './ViewRenderer';
import ViewRenderer from './ViewRenderer';
import type { JsonValue } from './types';

const source = (sourceIndex: number, value: JsonValue, diagnostic: { code: string } | null = null) => ({ sourceIndex, source: { kind: 'Base' as const, fieldId: `00000000-0000-4000-8000-${String(sourceIndex).padStart(12, '0')}` }, value, diagnostic });

describe('formatWidget', () => {
  it('parses indexed, signed, and escaped tokens losslessly', () => {
    expect(formatWidget('$$ $1 ${2:s}', [source(0, 'hero'), source(1, new LosslessNumber('9007199254740993123'))])).toEqual({ text: '$ hero +9007199254740993123' });
    expect(formatWidget('${1:s}', [source(0, new LosslessNumber('-0'))])).toEqual({ text: '-0' });
    expect(formatWidget('${1:s}', [source(0, new LosslessNumber('0'))])).toEqual({ text: '+0' });
    expect(formatWidget('', [])).toEqual({ text: '' });
  });
  it.each(['$', '$x', '${1}', '${1:q}', '$0', '$2', '$999999999999999999999999'])('rejects invalid, missing, or unsafe token %s', format => expect(formatWidget(format, [source(0, 1)])).toHaveProperty('error'));
  it.each(['text', true, null, {}])('rejects nonnumeric signed value', value => expect(formatWidget('${1:s}', [source(0, value)])).toHaveProperty('error'));
  it('distinguishes a legitimate null from a source diagnostic', () => {
    expect(formatWidget('$1', [source(0, null)])).toEqual({ text: 'null' });
    expect(formatWidget('$1', [source(0, null, { code: 'unknown_reference' })])).toHaveProperty('error', 'unknown_reference');
  });
});

describe('ViewRenderer', () => {
  it('renders nested layouts and widgets independently while continuing past source diagnostics', () => {
    render(<ViewRenderer roots={[{ kind: 'layout', nodeKey: 'a', title: 'outer', params: ['native'], children: [{ kind: 'widget', nodeKey: 'b', title: 'broken', params: null, sources: [], format: '$1', children: [] }, { kind: 'layout', nodeKey: 'c', title: 'inner', params: { direction: 'row' }, children: [{ kind: 'widget', nodeKey: 'd', title: 'healthy', params: 1, sources: [], format: '$1', children: [] }] }] }]} widgets={[{ nodeKey: 'b', sources: [source(0, null, { code: 'unknown_reference' })] }, { nodeKey: 'd', sources: [source(0, 'ok')] }]} />);
    expect(screen.getAllByText('unknown_reference')).toHaveLength(1);
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.getByText('outer')).toBeInTheDocument();
  });

  it('reports declared sources missing from the response', () => {
    render(<ViewRenderer roots={[{ kind: 'widget', nodeKey: 'missing', title: 'Missing', params: {}, children: [], sources: [{ kind: 'Base', fieldId: 'f' }], format: '' }]} widgets={[{ nodeKey: 'missing', sources: [] }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Источник $1 отсутствует.');
  });
});
