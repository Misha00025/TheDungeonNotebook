import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CharacterSheet from './CharacterSheet';
import { WorkspaceProvider, DirtyProvider } from './Workspace';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { LosslessNumber } from 'lossless-json';
import { stringifyJson } from './json';
import { afterEach, vi } from 'vitest';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import listStyles from '../../../../packages/shared/src/ui/List/List.module.css';
import pageStyles from '../../../../packages/shared/src/ui/PageLayout/PageLayout.module.css';
import characterStyles from './CharacterSheet.module.css';

const response = (body: unknown, status = 200) => new Response(stringifyJson(body), { status, headers: { 'Content-Type': 'application/json' } });
const id = 'abcdef01-2345-6789-abcd-ef0123456789';
const fields = [
  ['integer', 'Integer', 0], ['number', 'Number', 0], ['string', 'String', ''], ['boolean', 'Boolean', false], ['single', 'SingleChoice', 'one'], ['multi', 'MultiChoice', []]
].map(([key, valueType, value]) => ({ id: String(key), key: String(key), title: String(key), description: '', valueType, typeRevision: 1, options: valueType === 'SingleChoice' || valueType === 'MultiChoice' ? [{ optionKey: 'one', title: 'One' }, { optionKey: 'two', title: 'Two' }] : [], effectiveValue: value, isExplicit: true }));
const sheet = { contentRevision: 1, templateContentRevision: 1, description: 'Overview', baseFields: fields, virtualFields: [], formulaContentRevisions: [] };
const auth = (request: (url: string, options?: RequestInit) => Promise<Response>) => ({ status: 'authenticated', authenticated: true, userId: 4, error: null, config: { BFF_BASE: '/bff', API_BASE: '/bff/api' }, request: async (url: string, options?: RequestInit) => { const result = await request(url, options); if (url.endsWith('/presentation')) { const body = await result.clone().json().catch(() => undefined); if (Array.isArray(body) && body.length === 0) return response({ contentRevision: 0, defaults: {}, contextParams: {} }); } return result; }, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() }) as unknown as HubRemoteProps['auth'];
const CurrentPath: React.FC = () => <output aria-label="Current path">{useLocation().pathname}</output>;
const sheetTree = (request: (url: string, options?: RequestInit) => Promise<Response>, stats: boolean, initial = '/12/player/characters') => <MemoryRouter initialEntries={[initial]}><RemoteAuthProvider auth={auth(request)}><WorkspaceProvider mountPath="/"><DirtyProvider><CharacterSheet campaignId={12} characterId={id} stats={stats} /><CurrentPath /></DirtyProvider></WorkspaceProvider></RemoteAuthProvider></MemoryRouter>;
const renderSheet = (request: (url: string, options?: RequestInit) => Promise<Response>) => render(sheetTree(request, true));
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

afterEach(() => {
  cleanup();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
});

describe('CharacterSheet', () => {
  it('renders computed virtual values with human diagnostics without replacing diagnostics with zero', async () => {
    const computed = { ...sheet, virtualFields: [
      { id: 'value-field', key: 'value', title: 'Computed value', description: '', resultType: 'Number', value: 0, diagnostic: null },
      { id: 'error-field', key: 'broken', title: 'Broken value', description: '', resultType: 'Number', value: 0, diagnostic: { code: 'formula_error', message: 'Broken formula 00000000-0000-4000-8000-000000000001' } }
    ] };
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(computed);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderSheet(request);
    const valueCard = await screen.findByRole('heading', { name: 'Computed value' });
    expect(valueCard.closest('article')).toHaveTextContent('0');
    const errorCard = screen.getByRole('heading', { name: 'Broken value' }).closest('article');
    expect(errorCard).toHaveTextContent('Не удалось вычислить значение.');
    expect(errorCard).not.toHaveTextContent('0');
    expect(errorCard).not.toHaveTextContent('formula_error');
    expect(errorCard).not.toHaveTextContent('00000000-0000-4000-8000-000000000001');
    expect(screen.queryByText(/^Шаблон:/)).not.toBeInTheDocument();
  });

  it('loads computed fields for read access without requesting editing definitions', async () => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    renderSheet(request);
    expect(await screen.findByText('Только чтение')).toBeInTheDocument();
    expect(screen.getAllByText('Задано явно')).toHaveLength(6);
    expect(screen.getByRole('heading', { name: 'Базовые характеристики' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'string', level: 4 })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Тип: Integer');
    expect(screen.getByLabelText('string').closest('fieldset')).toBeDisabled();
    expect(request.mock.calls.some(([url]) => url.endsWith('/computed-sheet'))).toBe(true);
    expect(request.mock.calls.map(([url]) => url).some(url => /virtual-fields|formulas|assignments/.test(url))).toBe(false);
    expect(screen.queryByRole('button', { name: /Сбросить/ })).not.toBeInTheDocument();
  });

  it('omits the character selector and does not request the characters list', async () => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    render(sheetTree(request, true, `/12/player/characters/${id}/stats`));
    expect(await screen.findByText('Только чтение')).toBeInTheDocument();
    expect(screen.queryByLabelText('Персонаж')).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([url]) => url === '/api/campaigns/12/characters')).toHaveLength(0);
    const tabs = screen.getByRole('navigation', { name: 'Лист персонажа' });
    expect(within(tabs).getByRole('link', { name: 'Характеристики' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'К персонажам' })).toHaveAttribute('href', `/12/player/characters`);
  });

  it('renders desktop sheet tabs as links with the current tab marked', async () => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    render(sheetTree(request, true, `/12/player/characters/${id}/stats`));
    expect(await screen.findByText('Только чтение')).toBeInTheDocument();
    const tabs = await screen.findByRole('navigation', { name: 'Лист персонажа' });
    expect(within(tabs).getByRole('link', { name: 'Обзор' })).toHaveAttribute('href', `/12/player/characters/${id}/overview`);
    expect(within(tabs).getByRole('link', { name: 'Характеристики' })).toHaveAttribute('href', `/12/player/characters/${id}/stats`);
    expect(within(tabs).getByRole('link', { name: 'Характеристики' })).toHaveAttribute('aria-current', 'page');
    const back = screen.getByRole('link', { name: 'К персонажам' });
    expect(back.tagName).toBe('A');
    expect(back).toHaveClass(buttonStyles.button);
  });

  it('hides the sheet TabBar on mobile while keeping the overview and description in readonly mode', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ media: query, matches: true, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
    });
    const request = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    render(sheetTree(request, false, `/12/player/characters/${id}/overview`));
    expect(await screen.findByRole('heading', { name: 'Hero', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Ключевой')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить описание' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить описание' })).not.toBeInTheDocument();
    expect(await screen.findByText('Представление не назначено.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Представление персонажа' })).toBeInTheDocument();
    expect(screen.getByText('Только чтение')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Лист персонажа' })).not.toBeInTheDocument());
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
  });

  it.each(['gm', 'player'])('renders the %s overview presentation full-width below the shared header', async mode => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: false, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    const { container } = render(sheetTree(request, false, `/12/${mode}/characters/${id}/overview`));
    const heading = await screen.findByRole('heading', { name: 'Hero', level: 2 });
    const row = heading.parentElement;
    expect(row).toHaveClass(pageStyles.headerTitleRow);
    expect(row).toContainElement(screen.getByText('Ключевой'));
    expect(heading).not.toContainElement(screen.getByText('Ключевой'));
    expect(row?.nextElementSibling).toHaveTextContent('Overview');
    const overview = screen.getByRole('region', { name: 'Обзор персонажа' });
    expect(overview).toContainElement(screen.getByRole('region', { name: 'Представление персонажа' }));
    expect(overview.children).toHaveLength(1);
    expect(overview.parentElement).toHaveClass(listStyles.stretch);
    expect(overview).not.toHaveTextContent('Overview');
    expect(overview).not.toHaveTextContent('Hero');
    expect(overview.closest(`.${listStyles.columns2}`)).toBeNull();
    expect(container.querySelector('h3')).toBeNull();
  });

  it.each([['A description', 'new\nline'], ['Overview', '']])('edits a description explicitly from %s to %s', async (description, submitted) => {
    let latestSheet = { ...sheet, description };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(latestSheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT') {
        latestSheet = { ...latestSheet, description: submitted, contentRevision: 2 };
        return response({ contentRevision: 2 });
      }
      return response([]);
    });
    render(sheetTree(request, false));
    const pencil = await screen.findByRole('button', { name: 'Изменить описание' });
    expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument();
    fireEvent.click(pencil);
    const textarea = screen.getByRole('textbox', { name: 'Описание' });
    expect(textarea).toHaveValue(description);
    fireEvent.change(textarea, { target: { value: submitted } });
    fireEvent.blur(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    const put = request.mock.calls.find(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ description: submitted, expectedRevision: 1 });
    expect(put?.[0]).toBe(`/api/campaigns/12/characters/${id}/description`);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const editButton = screen.getByRole('button', { name: 'Изменить описание' });
    await waitFor(() => expect(editButton).toBeEnabled());
    if (submitted) expect(document.querySelector(`.${characterStyles.descriptionText}`)?.textContent).toBe(submitted);
    else expect(document.querySelector(`.${characterStyles.descriptionText}`)).toBeNull();
    fireEvent.click(editButton);
    expect(screen.getByRole('textbox', { name: 'Описание' })).toHaveValue(submitted);
    expect(screen.getByRole('button', { name: 'Сохранить описание' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменения описания' }));
    expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    confirm.mockRestore();
  });

  it('keeps a rejected description cancellation draft and closes only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const request = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      return response([]);
    });
    render(sheetTree(request, false));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить описание' }));
    const textarea = screen.getByRole('textbox', { name: 'Описание' });
    fireEvent.change(textarea, { target: { value: 'Draft' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(textarea).toHaveValue('Draft');
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменения описания' }));
    expect(textarea).toHaveValue('Draft');
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    confirm.mockRestore();
  });

  it.each([409, 502])('recovers description write status %s without retrying before explicit save', async status => {
    let latestSheet = { ...sheet };
    let sheetReads = 0;
    let writes = 0;
    let resolveRecovery!: (value: Response) => void;
    const recovery = new Promise<Response>(resolve => { resolveRecovery = resolve; });
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) {
        sheetReads += 1;
        if (sheetReads === 1) return response(latestSheet);
        if (sheetReads === 2) return recovery;
        return response(latestSheet);
      }
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 11 });
      if (url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT') {
        writes += 1;
        if (writes === 1) return response({ code: status === 502 ? 'write_outcome_unknown' : 'conflict', title: 'Conflict', detail: 'Changed' }, status);
        latestSheet = { ...latestSheet, description: 'My description', contentRevision: 8 };
        return response({ contentRevision: 8 });
      }
      return response([]);
    });
    render(sheetTree(request, false));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить описание' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Описание' }), { target: { value: 'My description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    expect(await screen.findByText('Обновляем данные после изменения на сервере. Черновик сохранён.')).toBeInTheDocument();
    await waitFor(() => expect(sheetReads).toBe(2));
    expect(screen.getByRole('textbox', { name: 'Описание' })).toHaveValue('My description');
    expect(screen.getByRole('textbox', { name: 'Описание' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохранить описание' })).toBeDisabled();
    expect(writes).toBe(1);
    await act(async () => {
      latestSheet = { ...latestSheet, contentRevision: 7, description: 'Server description' };
      resolveRecovery(response(latestSheet));
    });
    expect(await screen.findByText('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить описание' })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: 'Описание' })).toHaveValue('My description');
    expect(writes).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    await waitFor(() => expect(writes).toBe(2));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument());
    const attempts = request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT');
    expect(attempts.map(([, options]) => JSON.parse(String(options?.body)))).toEqual([
      { description: 'My description', expectedRevision: 1 },
      { description: 'My description', expectedRevision: 7 },
    ]);
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(2);
  });

  it('keeps a disabled description draft after forbidden write and allows confirmed cancellation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let permissionReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) {
        permissionReads += 1;
        return response({ canRead: true, canWrite: permissionReads === 1, canManageAccess: false });
      }
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT') return response({ code: 'forbidden', title: 'Forbidden', detail: 'No longer allowed' }, 403);
      return response([]);
    });
    try {
      render(sheetTree(request, false));
      fireEvent.click(await screen.findByRole('button', { name: 'Изменить описание' }));
      const textarea = screen.getByRole('textbox', { name: 'Описание' });
      fireEvent.change(textarea, { target: { value: 'My description' } });
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
      expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
      await waitFor(() => expect(permissionReads).toBeGreaterThan(1));
      expect(request.mock.calls.filter(([url]) => url.endsWith('/permissions'))).toHaveLength(2);
      expect(textarea).toHaveValue('My description');
      expect(textarea).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Сохранить описание' })).toBeDisabled();
      expect(screen.getByText('Только чтение')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Изменить описание' })).not.toBeInTheDocument();
      const cancel = screen.getByRole('button', { name: 'Отменить изменения описания' });
      expect(cancel).toBeEnabled();
      fireEvent.click(cancel);
      expect(confirm).toHaveBeenCalledWith('Отменить черновик описания?');
      expect(screen.queryByRole('textbox', { name: 'Описание' })).not.toBeInTheDocument();
      expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT')).toHaveLength(1);
    } finally {
      confirm.mockRestore();
    }
  });

  it('serializes description behind a field write without losing the metadata draft', async () => {
    let latestSheet = { ...sheet };
    let resolveField!: (value: Response) => void;
    const fieldResponse = new Promise<Response>(resolve => { resolveField = resolve; });
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(latestSheet);
      if (url.endsWith(`/characters/${id}`) && options?.method === 'PUT') return response({ id, campaignId: 12, name: 'Renamed', importance: 'Key', metadataRevision: 12 });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 11 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') return fieldResponse;
      if (url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT') {
        const body = JSON.parse(String(options.body));
        expect(body.expectedRevision).toBe(2);
        latestSheet = { ...latestSheet, contentRevision: 3, description: body.description };
        return response({ contentRevision: 3 });
      }
      return response([]);
    });
    render(sheetTree(request, true, `/12/player/characters/${id}/stats`));
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.click(screen.getByRole('button', { name: 'Изменить сведения персонажа' }));
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Изменить описание' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Описание' }), { target: { value: 'Description draft' } });
    fireEvent.change(screen.getByLabelText('string'), { target: { value: 'Field draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByRole('textbox', { name: 'Описание' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохранить описание' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT')).toHaveLength(0);
    expect(screen.getByLabelText('Имя')).toHaveValue('Renamed');
    await act(async () => {
      latestSheet = { ...latestSheet, contentRevision: 2, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'Field draft' } : field) };
      resolveField(response({ contentRevision: 2 }));
    });
    expect(await screen.findByText('Поле сохранено.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить описание' })).toBeEnabled());
    expect(screen.getByLabelText('Имя')).toHaveValue('Renamed');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT')).toBe(true));
    const descriptionWrite = request.mock.calls.find(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT');
    expect(JSON.parse(String(descriptionWrite?.[1]?.body))).toEqual({ description: 'Description draft', expectedRevision: 2 });
    expect(screen.getByLabelText('Имя')).toHaveValue('Renamed');
    expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT')).toHaveLength(1);
  });

  it('saves exactly the changed explicit field with the sheet revision and supports typed falsy values', async () => {
    let latest = sheet;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(latest);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { latest = { ...sheet, contentRevision: 2, baseFields: fields.map(field => field.id === 'string' ? { ...field, isExplicit: true, effectiveValue: 'new value' } : field) }; return response(latest); }
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: 'Сохранить string' });
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
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/boolean') && options?.method === 'PUT') return response(saved);
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: 'Сохранить boolean' });
    fireEvent.click(await screen.findByLabelText('boolean'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить boolean' }));
    await waitFor(() => expect(screen.getAllByText('Задано явно')).toHaveLength(6));
    const call = request.mock.calls.find(([url, options]) => url.endsWith('/base-values/boolean') && options?.method === 'PUT');
    expect(call).toBeDefined();
    expect(String(call?.[1]?.body)).toContain(`"expectedRevision":${revision}`);
    expect(screen.getByLabelText('boolean')).toBeChecked();
  });

  it('automatically rereads a conflicting content write, preserves the draft, and waits for explicit Save', async () => {
    let writes = 0;
    let sheetReads = 0;
    const latest = { ...sheet, contentRevision: 7, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'server', isExplicit: true } : field) };
    const saved = { ...latest, contentRevision: 8, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'my draft', isExplicit: true } : field) };
    let resolveRecovery!: (value: Response) => void;
    const recovery = new Promise<Response>(resolve => { resolveRecovery = resolve; });
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) {
        sheetReads += 1;
        if (sheetReads === 1) return response(sheet);
        if (sheetReads === 2) return recovery;
        return response(saved);
      }
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') {
        writes += 1;
        return writes === 1 ? response({ code: 'conflict', title: 'Conflict', detail: 'Changed' }, 409) : response(saved);
      }
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'my draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Обновляем данные после изменения на сервере. Черновик сохранён.')).toBeInTheDocument();
    await waitFor(() => expect(sheetReads).toBe(2));
    expect(screen.getByLabelText('string')).toHaveValue('my draft');
    expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeDisabled();
    expect(writes).toBe(1);
    const blockedNotification = screen.getByText('Обновляем данные после изменения на сервере. Черновик сохранён.').closest('[role="alert"]');
    expect(blockedNotification).toBeInTheDocument();
    fireEvent.click(within(blockedNotification as HTMLElement).getByRole('button', { name: 'Закрыть уведомление' }));
    expect(blockedNotification).not.toBeInTheDocument();
    expect(screen.getByLabelText('string')).toHaveValue('my draft');
    expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeDisabled();
    expect(writes).toBe(1);
    await act(async () => { resolveRecovery(response(latest)); });
    expect(await screen.findByText('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('string')).toHaveValue('my draft'));
    expect(screen.queryByLabelText('Снимок листа')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeEnabled());
    expect(writes).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    await waitFor(() => expect(writes).toBe(2));
    const attempts = request.mock.calls.filter(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT');
    expect(attempts.map(([, options]) => JSON.parse(String(options?.body)).expectedRevision)).toEqual([1, 7]);
  });

  it('automatically recovers a changed revision when returning to stats without dropping drafts', async () => {
    let reads = 0;
    let latest = { ...sheet, contentRevision: 2, baseFields: fields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'server value' } : field) };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(reads++ === 0 ? sheet : latest);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { latest = { ...latest, contentRevision: 3, baseFields: latest.baseFields.map(field => field.id === 'string' ? { ...field, effectiveValue: 'my retained draft' } : field) }; return response({ contentRevision: 3 }); }
      return response([]);
    });
    const view = render(sheetTree(request, true));
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'my retained draft' } });
    view.rerender(sheetTree(request, false));
    view.rerender(sheetTree(request, true));
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(3));
    expect(screen.getByLabelText('string')).toHaveValue('my retained draft');
    expect(await screen.findByText('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Снимок листа')).not.toBeInTheDocument();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT')).toBe(true));
    const put = request.mock.calls.find(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body)).expectedRevision).toBe(2);
  });

  it('does not retry an unknown write after its automatic snapshot read', async () => {
    let writes = 0;
    let sheetReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) { sheetReads += 1; return response(sheet); }
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { writes += 1; return response({ code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, 502); }
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.')).toBeInTheDocument();
    await waitFor(() => expect(sheetReads).toBe(2));
    expect(writes).toBe(1);
    expect(screen.getByLabelText('string')).toHaveValue('draft');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeEnabled());
    expect(writes).toBe(1);
  });

  it('stops after an automatic reread error and retries only after the error action', async () => {
    let writes = 0;
    let sheetReads = 0;
    const latest = { ...sheet, contentRevision: 6 };
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) {
        sheetReads += 1;
        if (sheetReads === 2) return response({ code: 'dependency_unavailable', title: 'Unavailable', detail: 'Snapshot unavailable' }, 503);
        return response(sheetReads === 1 ? sheet : latest);
      }
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') { writes += 1; return response({ code: 'conflict', title: 'Conflict', detail: 'Changed' }, 409); }
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'kept draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Зависимый сервис временно недоступен.')).toBeInTheDocument();
    expect(screen.getByLabelText('string')).toHaveValue('kept draft');
    expect(screen.getByRole('button', { name: 'Повторить загрузку' })).toBeInTheDocument();
    expect(writes).toBe(1);
    expect(sheetReads).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    expect(await screen.findByText('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.')).toBeInTheDocument();
    await waitFor(() => expect(sheetReads).toBe(3));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить string' })).toBeEnabled());
    expect(screen.getByLabelText('string')).toHaveValue('kept draft');
    expect(writes).toBe(1);
  });

  it('refreshes character permissions after a forbidden write without dropping the draft', async () => {
    let permissionReads = 0;
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) {
        permissionReads += 1;
        return response({ canRead: true, canWrite: permissionReads === 1, canManageAccess: false });
      }
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith('/base-values/string') && options?.method === 'PUT') return response({ code: 'forbidden', title: 'Forbidden', detail: 'No longer allowed' }, 403);
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'kept draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Доступ запрещён.')).toBeInTheDocument();
    await waitFor(() => expect(permissionReads).toBeGreaterThan(1));
    expect(screen.getByLabelText('string')).toHaveTextContent('kept draft');
    expect(request.mock.calls.filter(([url, options]) => url.endsWith('/base-values/string') && options?.method === 'PUT')).toHaveLength(1);
  });

  it.each([409, 502])('automatically rereads metadata after status %s and saves the retained inline draft with the fresh revision', async status => {
    const initialMetadata = { id, campaignId: 12, name: 'Hero', importance: 'Key' as const, metadataRevision: 11 };
    const freshMetadata = { ...initialMetadata, name: 'Server name', metadataRevision: 12 };
    let metadataReads = 0;
    let writes = 0;
    let resolveMetadata!: (value: Response) => void;
    const pendingMetadata = new Promise<Response>(resolve => { resolveMetadata = resolve; });
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`) && options?.method === 'PUT') {
        writes += 1;
        if (writes === 1) return response({ code: status === 502 ? 'write_outcome_unknown' : 'metadata_conflict', title: 'Conflict', detail: 'Changed' }, status);
        return response({ ...freshMetadata, name: 'Draft name', metadataRevision: 13 });
      }
      if (url.endsWith(`/characters/${id}`)) {
        metadataReads += 1;
        if (metadataReads === 1) return response(initialMetadata);
        if (metadataReads === 2) return pendingMetadata;
        return response(freshMetadata);
      }
      return response([]);
    });
    render(sheetTree(request, false, `/12/player/characters/${id}/overview`));
    expect(await screen.findByRole('button', { name: 'Изменить сведения персонажа' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Изменить сведения персонажа' }));
    const name = screen.getByLabelText('Имя');
    const importance = screen.getByLabelText('Важность');
    fireEvent.change(name, { target: { value: 'Draft name' } });
    fireEvent.change(importance, { target: { value: 'Secondary' } });
    fireEvent.blur(name);
    expect(writes).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить сведения персонажа' }));
    await waitFor(() => expect(metadataReads).toBe(2));
    expect(name).toHaveValue('Draft name');
    expect(name).toBeDisabled();
    expect(writes).toBe(1);
    await act(async () => { resolveMetadata(response(freshMetadata)); });
    expect(await screen.findByText('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.')).toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toHaveValue('Draft name');
    expect(screen.getByLabelText('Важность')).toHaveValue('Secondary');
    expect(screen.queryByText('Серверные метаданные: Server name')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить сведения персонажа' })).toBeEnabled());
    expect(writes).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить сведения персонажа' }));
    await waitFor(() => expect(writes).toBe(2));
    const writeAttempts = request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}`) && options?.method === 'PUT');
    expect(writeAttempts).toHaveLength(2);
    expect(JSON.parse(String(writeAttempts[0][1]?.body))).toMatchObject({ expectedRevision: 11 });
    expect(JSON.parse(String(writeAttempts[1][1]?.body))).toEqual({ name: 'Draft name', importance: 'Secondary', expectedRevision: 12 });
    expect(await screen.findByRole('heading', { name: 'Draft name' })).toBeInTheDocument();
  });

  it('does not write on metadata edit or blur and keeps rejected inline cancellation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const request = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 11 });
      return response([]);
    });
    renderSheet(request);
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить сведения персонажа' }));
    const name = screen.getByLabelText('Имя');
    fireEvent.change(name, { target: { value: 'Unsaved name' } });
    fireEvent.blur(name);
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    fireEvent.keyDown(name, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledWith('Отменить черновик метаданных?');
    expect(screen.getByLabelText('Имя')).toHaveValue('Unsaved name');
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменения сведений персонажа' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Имя')).toHaveValue('Unsaved name');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    confirm.mockRestore();
  });

  it('saves inline metadata once on Enter without an implicit form submission', async () => {
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/permissions')) return response({ canRead: true, canWrite: true, canManageAccess: false });
      if (url.endsWith('/computed-sheet')) return response(sheet);
      if (url.endsWith(`/characters/${id}`) && options?.method === 'PUT') return response({ id, campaignId: 12, name: 'Enter name', importance: 'Key', metadataRevision: 12 });
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 11 });
      return response([]);
    });
    renderSheet(request);
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить сведения персонажа' }));
    const name = screen.getByLabelText('Имя');
    fireEvent.change(name, { target: { value: 'Enter name' } });
    fireEvent.keyDown(name, { key: 'Enter', isComposing: true });
    expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}`) && options?.method === 'PUT')).toHaveLength(0);
    fireEvent.keyDown(name, { key: 'Enter' });
    await waitFor(() => expect(request.mock.calls.filter(([url, options]) => url.endsWith(`/characters/${id}`) && options?.method === 'PUT')).toHaveLength(1));
    const write = request.mock.calls.find(([url, options]) => url.endsWith(`/characters/${id}`) && options?.method === 'PUT');
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({ name: 'Enter name', importance: 'Key', expectedRevision: 11 });
  });

  it('serializes description and field writes while keeping independent drafts and metadata revision', async () => {
    let contentRevision = 1;
    let currentSheet = { ...sheet, contentRevision };
    const meta = { id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 11 };
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
    await screen.findByRole('button', { name: 'Изменить сведения персонажа' });
    fireEvent.click(screen.getByRole('button', { name: 'Изменить описание' }));
    fireEvent.change(await screen.findByLabelText('Описание'), { target: { value: 'description draft' } });
    view.rerender(sheetTree(request, true));
    await screen.findByRole('button', { name: 'Сохранить string' });
    fireEvent.change(await screen.findByLabelText('string'), { target: { value: 'saved field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить string' }));
    expect(await screen.findByText('Поле сохранено.')).toBeInTheDocument();
    view.rerender(sheetTree(request, false));
    expect(screen.getByLabelText('Описание')).toHaveValue('description draft');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
    await waitFor(() => expect(request.mock.calls.some(([url, options]) => url.endsWith(`/characters/${id}/description`) && options?.method === 'PUT')).toBe(true));
    await waitFor(() => expect(screen.queryByLabelText('Описание')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Изменить сведения персонажа' }));
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Renamed' } });
    expect(request.mock.calls.filter(([url, options]) => url === `/api/campaigns/12/characters/${id}` && options?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить сведения персонажа' }));
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
      if (url.endsWith(`/characters/${id}`)) return response({ id, campaignId: 12, name: 'Hero', importance: 'Key', metadataRevision: 1 });
      if (url.endsWith(`/base-values/${fieldId}`) && options?.method === 'PUT') return response({ ...base, contentRevision: 2, baseFields: [{ ...typedField, isExplicit: true }] });
      return response([]);
    });
    renderSheet(request);
    await screen.findByRole('button', { name: `Сохранить ${fieldId}` });
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
