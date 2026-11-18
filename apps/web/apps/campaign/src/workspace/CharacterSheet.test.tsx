import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CharacterSheet from './CharacterSheet';
import { WorkspaceProvider, DirtyProvider } from './Workspace';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { LosslessNumber } from 'lossless-json';
import { stringifyJson } from './json';

const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const id = 'abcdef01-2345-6789-abcd-ef0123456789';
const fields = [
  ['integer', 'Integer', 0], ['number', 'Number', 0], ['string', 'String', ''], ['boolean', 'Boolean', false], ['single', 'SingleChoice', 'one'], ['multi', 'MultiChoice', []]
].map(([key, valueType, value]) => ({ id: String(key), key: String(key), title: String(key), description: '', valueType, typeRevision: 1, options: valueType === 'SingleChoice' || valueType === 'MultiChoice' ? [{ optionKey: 'one', title: 'One' }, { optionKey: 'two', title: 'Two' }] : [], effectiveValue: value, isExplicit: true }));
const sheet = { contentRevision: 1, templateContentRevision: 1, description: 'Overview', baseFields: fields, virtualFields: [], formulaContentRevisions: [] };
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request: async (url: string, options?: RequestInit) => { const result = await request(url, options); if (url.endsWith('/presentation')) { const body = await result.clone().json().catch(() => undefined); if (Array.isArray(body) && body.length === 0) return response({ contentRevision: 0, defaults: {}, contextParams: {} }); } return result; }, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const CurrentPath: React.FC = () => <output aria-label="Current path">{useLocation().pathname}</output>;
const sheetTree = (request: (url: string, options?: RequestInit) => Promise<Response>, stats: boolean) => <MemoryRouter initialEntries={['/12/player/characters']}><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><DirtyProvider><CharacterSheet campaignId={12} characterId={id} stats={stats} /><CurrentPath /></DirtyProvider></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>;
const renderSheet = (request: (url: string, options?: RequestInit) => Promise<Response>) => render(sheetTree(request, true));

describe('CharacterSheet', () => {
  it('renders computed virtual values and diagnostic code without replacing diagnostics with zero', async () => {
    const computed = { ...sheet, virtualFields: [
      { id: 'value-field', key: 'value', title: 'Computed value', description: '', resultType: 'Number', value: 0, diagnostic: null },
      { id: 'error-field', key: 'broken', title: 'Broken value', description: '', resultType: 'Number', value: 0, diagnostic: { code: 'formula_error', message: 'Broken formula' } }
    ] };
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(computed);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderSheet(request);
    const valueCard = await screen.findByRole('heading', { name: 'Computed value' });
    expect(valueCard.parentElement).toHaveTextContent('0');
    const errorCard = screen.getByRole('heading', { name: 'Broken value' }).parentElement;
    expect(errorCard).toHaveTextContent('formula_error: Broken formula');
    expect(errorCard).not.toHaveTextContent('0');
  });

  it('loads computed fields for read access without requesting editing definitions', async () => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderSheet(request);
    expect(await screen.findByText('Только чтение')).toBeInTheDocument();
    expect(screen.getAllByText('Задано явно')).toHaveLength(6);
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
    expect(request.mock.calls.map(([url]) => url).some(url => /virtual-fields|formulas|assignments/.test(url))).toBe(false);
    expect(screen.queryByRole('button', { name: /Сбросить/ })).not.toBeInTheDocument();
  });

  it('selects another listed character using an encoded GUID and preserves the active tab', async () => {
    const otherId = 'abcdef02-2345-6789-abcd-ef0123456789';
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith('/characters')) return response([
        { id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 },
        { id: otherId, campaignId: 12, templateId: 'template', name: 'Other', importance: 'Secondary', metadataRevision: 1 }
      ]);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderSheet(request);
    fireEvent.change(await screen.findByLabelText('Персонаж'), { target: { value: otherId } });
    expect(screen.getByLabelText('Current path')).toHaveTextContent(`/12/player/characters/${otherId}/stats`);
  });

  it('saves exactly the changed explicit field with the sheet revision and supports typed falsy values', async () => {
    let latest = sheet;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(latest);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { latest = { ...sheet, contentRevision: 2, baseFields: fields.map(field => field.id === 'string' ? { ...field, isExplicit: true, effectiveValue: 'new value' } : field) }; return response(latest); }
      return response([]);
    });
    renderSheet(request);
    const stringInput = await screen.findByLabelText('string');
    fireEvent.change(stringInput, { target: { value: 'new value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT')).toBe(true));
    const write = request.mock.calls.find(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT');
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({ value: 'new value', expectedRevision: 1 });
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    expect(screen.getByLabelText('string')).toHaveValue('new value');
  });

  it('writes an inherited false-valued field and keeps the exact int64 content revision', async () => {
    const revision = '9223372036854775807';
    const inherited = { ...sheet, contentRevision: new LosslessNumber(revision), baseFields: fields.map(field => field.id === 'boolean' ? { ...field, isExplicit: false } : field) };
    const saved = { ...inherited, contentRevision: new LosslessNumber('9223372036854775806'), baseFields: inherited.baseFields.map(field => field.id === 'boolean' ? { ...field, isExplicit: true, effectiveValue: true } : field) };
    let reads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) { const current = reads++ === 0 ? inherited : saved; return response(current); }
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/boolean') && options?.method === 'PUT') return response(saved);
      return response([]);
    });
    renderSheet(request);
    fireEvent.click(await screen.findByLabelText('boolean'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить boolean' }));
    await waitFor(() => expect(screen.getAllByText('Задано явно')).toHaveLength(6));
    const call = request.mock.calls.find(([url, options]) => url.endsWith('/base-values/boolean') && options?.method === 'PUT');
    expect(call).toBeDefined();
    expect(String(call?.[1]?.body)).toContain(`"expectedRevision":${revision}`);
    expect(screen.getByLabelText('boolean')).toBeChecked();
  });

  it('blocks a conflicting content write until explicit reread and preserves the draft', async () => {
    let writes = 0;
    let sheetReads = 0;
    const latest = { ...sheet, contentRevision: 7, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'server', isExplicit: true } : field) };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheetReads++ === 0 ? sheet : { ...latest, virtualFields: [], formulaContentRevisions: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { writes += 1; return response({ code: 'conflict', title: 'Conflict', detail: 'Changed' }, 409); }
      return response([]);
    });
    renderSheet(request);
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'my draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Запись заблокирована до перечитывания снимка.')).toBeInTheDocument();
    expect(writes).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать лист' }));
    await waitFor(() => expect(screen.getByLabelText('string')).toHaveValue('my draft'));
    expect(screen.getByLabelText('Снимок листа')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    await waitFor(() => expect(writes).toBe(2));
    const attempts = request.mock.calls.filter(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT');
    expect(attempts.map(([, options]) => JSON.parse(String(options?.body)).expectedRevision)).toEqual([1, 7]);
  });

  it('rereads computed content when returning to stats and blocks a revision change without dropping drafts', async () => {
    let reads = 0;
    let latest = { ...sheet, contentRevision: 2, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'server value' } : field) };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(reads++ === 0 ? sheet : latest);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { latest = { ...latest, contentRevision: 3, baseFields: latest.baseFields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'my retained draft' } : field) }; return response({ contentRevision: 3 }); }
      return response([]);
    });
    const view = render(sheetTree(request, true));
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'my retained draft' } });
    view.rerender(sheetTree(request, false));
    view.rerender(sheetTree(request, true));
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2));
    expect(screen.getByLabelText('string')).toHaveValue('my retained draft');
    expect(await screen.findByText('Запись заблокирована до перечитывания снимка.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать лист' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT')).toBe(true));
    const put = request.mock.calls.find(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body)).expectedRevision).toBe(2);
  });

  it('does not automatically retry an unknown write outcome', async () => {
    let writes = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { writes += 1; return response({ code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, 502); }
      return response([]);
    });
    renderSheet(request);
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText(/Результат операции неизвестен/)).toBeInTheDocument();
    expect(writes).toBe(1);
    expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeDisabled();
  });

  it('refreshes character permissions after a forbidden write without dropping the draft', async () => {
    let permissionReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) {
        permissionReads += 1;
        return response({ canRead: true, canWrite: permissionReads === 1, canManageAccess: false });
      }
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') return response({ code: 'forbidden', title: 'Forbidden', detail: 'No longer allowed' }, 403);
      return response([]);
    });
    renderSheet(request);
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'kept draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
    await waitFor(() => expect(permissionReads).toBeGreaterThan(1));
    expect(screen.getByLabelText('string')).toHaveTextContent('kept draft');
    expect(request.mock.calls.filter(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT')).toHaveLength(1);
  });

  it('serializes description and field writes while keeping independent drafts and metadata revision', async () => {
    let contentRevision = 1;
    let currentSheet = { ...sheet, contentRevision };
    const meta = { id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 11 };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
       if (url.endsWith('/computed-sheet')) return response(currentSheet);
      if (url.endsWith(`/characters/${id}`) && options?.method === 'PUT') return response({ ...meta, name: 'Renamed', metadataRevision: 12 });
      if (url.endsWith(`/characters/${id}`)) return response(meta);
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') {
        expect(JSON.parse(String(options.body)).expectedRevision).toBe(1);
        contentRevision = 2;
        currentSheet = { ...sheet, contentRevision, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'saved field' } : field) };
        return response(currentSheet);
      }
      if (url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT') {
        expect(JSON.parse(String(options.body)).expectedRevision).toBe(2);
        contentRevision = 3;
        currentSheet = { ...currentSheet, contentRevision, description: 'description draft' };
        return response({ contentRevision });
      }
      return response([]);
    });
    const view = render(sheetTree(request, false));
    fireEvent.change(await screen.findByLabelText('Описание'), { target: { value: 'description draft' } });
    view.rerender(sheetTree(request, true));
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'saved field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Поле сохранено.')).toBeInTheDocument();
    view.rerender(sheetTree(request, false));
    expect(screen.getByLabelText('Описание')).toHaveValue('description draft');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT')).toBe(true));
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метаданные' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url === `/api/campaigns/12/characters/${id}` && options?.method === 'PUT')).toBe(true));
    const metadataWrite = request.mock.calls.find(([url, options]) => url === `/api/campaigns/12/characters/${id}` && options?.method === 'PUT');
    expect(JSON.parse(String(metadataWrite?.[1]?.body))).toEqual({ name: 'Renamed', importance: 'Key', expectedRevision: 11 });
  });

  it.each([
    ['zero', 'Integer', 1, 0],
    ['fraction', 'Number', 0.5, 0.25],
    ['false', 'Boolean', true, false],
    ['empty', 'String', 'x', ''],
    ['choice', 'SingleChoice', 'one', 'two'],
    ['empty-list', 'MultiChoice', ['one'], []]
  ])('does not treat a falsy %s draft as absent', async (fieldId, valueType, initial, expected) => {
    const typedField = { id: fieldId, key: fieldId, title: fieldId, description: '', valueType, typeRevision: 1, options: valueType === 'MultiChoice' || valueType === 'SingleChoice' ? [{ optionKey: 'one', title: 'One' }, { optionKey: 'two', title: 'Two' }] : [], effectiveValue: initial, isExplicit: false };
    const base = { ...sheet, baseFields: [typedField] };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response({ ...base, virtualFields: [], formulaContentRevisions: [] });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, templateId: 'template-id', name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith(`/base-values/${fieldId}`) && options?.method === 'PUT') return response({ ...base, contentRevision: 2, baseFields: [{ ...typedField, isExplicit: true }] });
      return response([]);
    });
    renderSheet(request);
    const input = await screen.findByLabelText(fieldId);
    if (valueType === 'Boolean') fireEvent.click(input);
    else if (valueType === 'String') fireEvent.change(input, { target: { value: '' } });
    else if (valueType === 'MultiChoice') fireEvent.click(screen.getByLabelText('One'));
    else if (valueType === 'SingleChoice') fireEvent.change(input, { target: { value: 'two' } });
    else if (valueType === 'Number') fireEvent.change(input, { target: { value: '0.25' } });
    else fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: `Сохранить ${fieldId}` }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith(`/base-values/${fieldId}`) && options?.method === 'PUT')).toBe(true));
    const call = request.mock.calls.find(([url, options]) => url.endsWith(`/base-values/${fieldId}`) && options?.method === 'PUT');
    expect(JSON.parse(String(call?.[1]?.body)).value).toEqual(expected);
  });
});
