import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LegacyCatalogImportWizard from './LegacyCatalogImportWizard';
import type { LegacyObject } from './legacyDiscovery';

const shared = vi.hoisted(() => ({
  api: {
    getCatalogAttributes: vi.fn(),
    putCatalogAttributes: vi.fn(),
    createCatalogEntry: vi.fn(),
    getCatalogEntry: vi.fn(),
    getCatalogContent: vi.fn()
  },
  reloadPermissions: vi.fn()
}));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api: shared.api, sessionKey: 'test-session' }),
  useDirtyDraft: () => () => undefined
}));

vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({
    mode: 'gm',
    permissions: { canWrite: true },
    permissionsLoading: false,
    reloadPermissions: shared.reloadPermissions
  })
}));

describe('LegacyCatalogImportWizard', () => {
  beforeEach(() => {
    Object.values(shared.api).forEach(method => method.mockReset());
    shared.reloadPermissions.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  it('imports only the explicitly selected item definition and opted-in typed attributes after confirmation', async () => {
    shared.api.getCatalogAttributes.mockResolvedValue({
      campaignId: 12,
      contentRevision: 4,
      data: { definitions: [] }
    });
    shared.api.putCatalogAttributes.mockResolvedValue({
      campaignId: 12,
      contentRevision: 5,
      data: {
        definitions: [
          { id: 'material-id', title: 'material', typeKey: 'string', options: [] },
          { id: 'price-id', title: 'Цена', typeKey: 'integer', options: [] }
        ]
      }
    });
    shared.api.createCatalogEntry.mockResolvedValue({});

    const item: LegacyObject = {
      name: 'Старый меч',
      sourceId: 'legacy-item-1',
      data: {
        description: 'Клинок из стали.',
        isSecret: true,
        price: 125,
        imageLink: 'https://example.test/sword.png',
        attributes: [
          { key: 'material', value: 'сталь' },
          { key: 'rarity', value: 'редкий' }
        ]
      },
      fields: [],
      properties: []
    };
    render(<LegacyCatalogImportWizard items={[item]} skills={[]} skillAttributes={[]} campaignId={12} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByLabelText('Импортировать предмет Старый меч'));
    expect(shared.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(shared.api.createCatalogEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByLabelText('Импортировать атрибут Цена'));
    fireEvent.click(screen.getByLabelText('Импортировать атрибут material'));
    expect(screen.getByLabelText('Импортировать атрибут rarity')).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить импорт' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(shared.api.putCatalogAttributes).not.toHaveBeenCalled();
    expect(shared.api.createCatalogEntry).not.toHaveBeenCalled();

    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить импорт' }));
    await waitFor(() => expect(shared.api.createCatalogEntry).toHaveBeenCalledTimes(1));

    expect(shared.api.putCatalogAttributes).toHaveBeenCalledTimes(1);
    expect(shared.api.putCatalogAttributes).toHaveBeenCalledWith(12, 'Item', {
      expectedRevision: 4,
      definitions: [
        { title: 'material', typeKey: 'string', options: [] },
        { title: 'Цена', typeKey: 'integer', options: [] }
      ]
    });
    const [campaignId, kind, payload] = shared.api.createCatalogEntry.mock.calls[0]!;
    expect(campaignId).toBe(12);
    expect(kind).toBe('Item');
    expect(payload).toEqual(expect.objectContaining({
      name: 'Старый меч',
      isHidden: true,
      quantityUnit: 'Whole',
      allowNegative: false,
      description: 'Клинок из стали.',
      attributes: [
        expect.objectContaining({ attributeId: 'price-id', value: 125, editLevel: 'Definition' }),
        expect.objectContaining({ attributeId: 'material-id', value: 'сталь', editLevel: 'Definition' })
      ]
    }));
    expect(payload.attributes).toHaveLength(2);
    expect(Object.keys(payload).sort()).toEqual(['allowNegative', 'attributes', 'description', 'isHidden', 'name', 'quantityUnit', 'requestId'].sort());
    expect(payload.attributes.every((attribute: { id: string }) => Boolean(attribute.id))).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('rarity');
    expect(JSON.stringify(payload)).not.toContain('imageLink');
    expect(JSON.stringify(payload)).not.toContain('characterItems');
    expect(JSON.stringify(payload)).not.toContain('characterSkills');
  });
});
