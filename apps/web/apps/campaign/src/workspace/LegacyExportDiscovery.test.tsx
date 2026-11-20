import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LegacyExportDiscovery from './LegacyExportDiscovery';

const shared = vi.hoisted(() => ({ sessionKey: 'session-a', canWrite: true, api: { createCharacter: vi.fn(), putCharacter: vi.fn(), putDescription: vi.fn(), putBaseValue: vi.fn(), putTemplateContent: vi.fn() } }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ sessionKey: shared.sessionKey, api: shared.api }) }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ mode: 'gm', permissions: { canRead: true, canWrite: shared.canWrite }, permissionsLoading: false }) }));

const renderScreen = () => render(<MemoryRouter initialEntries={['/groups/12/gm/settings/export']}><Routes><Route path="/groups/:groupId/gm/settings/export" element={<LegacyExportDiscovery />} /></Routes></MemoryRouter>);
const makeFile = (name: string, text: string | Promise<string>) => {
  const file = new File([], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: vi.fn(() => Promise.resolve(text)) });
  return file;
};
const choose = (file: File) => fireEvent.change(screen.getByLabelText('JSON старого экспорта'), { target: { files: [file] } });
afterEach(() => vi.restoreAllMocks());

describe('LegacyExportDiscovery', () => {
  it('shows discovered file content locally without invoking writes or fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderScreen();
    choose(makeFile('small.json', '{"version":1,"characters":[{"oldId":1,"templateOldId":2,"name":"Hero","fields":{}}],"charlists":[{"oldId":2,"name":"Template","fields":{}}],"items":[{"oldId":3,"name":"Item"}]}'));
    expect(await screen.findByText('Hero')).toBeInTheDocument();
    expect(screen.getAllByText('Template').length).toBeGreaterThan(0);
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Показано только содержимое файла. Ничего не импортировано.')).toBeInTheDocument();
    expect(screen.getByText('Обнаружено, но запись этих данных текущим API не поддерживается.')).toBeInTheDocument();
    expect(Object.values(shared.api).every(method => method.mock.calls.length === 0)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('replaces a previous result with a clear parser error, then accepts a valid file', async () => {
    renderScreen();
    choose(makeFile('valid.json', '{"version":1,"characters":[{"oldId":1,"name":"Earlier Hero","fields":{}}]}'));
    expect(await screen.findByText('Earlier Hero')).toBeInTheDocument();
    choose(makeFile('broken.json', '{'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Файл не содержит корректный JSON.');
    expect(screen.queryByText('Earlier Hero')).not.toBeInTheDocument();
    choose(makeFile('recovered.json', '{"version":1,"characters":[{"oldId":2,"name":"Current Hero","fields":{}}]}'));
    expect(await screen.findByText('Current Hero')).toBeInTheDocument();
  });

  it('does not allow stale reads to replace a newer file or restore content after clearing', async () => {
    let resolveA!: (text: string) => void;
    const pendingA = new Promise<string>(resolve => { resolveA = resolve; });
    renderScreen();
    choose(makeFile('pending.json', pendingA));
    choose(makeFile('current.json', '{"version":1,"characters":[{"oldId":2,"name":"Current Hero","fields":{}}]}'));
    expect(await screen.findByText('Current Hero')).toBeInTheDocument();
    await act(async () => { resolveA('{"version":1,"characters":[{"oldId":1,"name":"Stale Hero","fields":{}}]}'); });
    expect(screen.queryByText('Stale Hero')).not.toBeInTheDocument();
    let resolvePending!: (text: string) => void;
    const pending = new Promise<string>(resolve => { resolvePending = resolve; });
    choose(makeFile('cleared.json', pending));
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    await act(async () => { resolvePending('{"version":1,"characters":[{"oldId":3,"name":"After Clear","fields":{}}]}'); });
    expect(screen.queryByText('Current Hero')).not.toBeInTheDocument();
    expect(screen.queryByText('After Clear')).not.toBeInTheDocument();
  });
});
