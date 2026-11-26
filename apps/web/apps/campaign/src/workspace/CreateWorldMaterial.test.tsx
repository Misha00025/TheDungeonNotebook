import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateWorldMaterialPage as CreateWorldMaterialForm } from './WorldManagement';

const shared = vi.hoisted(() => ({
  api: { createWorldMaterial: vi.fn(), updateWorldMaterial: vi.fn() },
  onCreated: vi.fn(),
}));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api: shared.api }),
  useDirtyDraft: () => vi.fn(),
}));
vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({ reloadPermissions: vi.fn() }),
}));

const createdMaterial = {
  id: 'material-1',
  campaignId: 4,
  kind: 'lore' as const,
  title: 'The Old Keep',
  description: 'A forgotten stronghold',
  tags: [],
  isPublished: false,
  metadataRevision: 7,
};
const publishedMaterial = { ...createdMaterial, isPublished: true, metadataRevision: 8 };
const requestId = 'fixed-request-id';

describe('CreateWorldMaterialPage', () => {
  beforeEach(() => {
    Object.values(shared.api).forEach(method => method.mockReset());
    shared.onCreated.mockReset();
    shared.api.createWorldMaterial.mockResolvedValue({ material: createdMaterial, bodyVersion: 'body-v3' });
    shared.api.updateWorldMaterial.mockResolvedValue(publishedMaterial);
  });

  it('creates a material and opens it to players', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(requestId);
    render(
      <CreateWorldMaterialForm
        campaignId={4}
        kind="lore"
        scope="4"
        canWrite
        permissionsLoading={false}
        onCancel={vi.fn()}
        onCreated={shared.onCreated}
      />,
    );

    const openToPlayers = screen.getByLabelText('Открыть игрокам');
    expect(openToPlayers).not.toBeChecked();
    fireEvent.click(openToPlayers);
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'The Old Keep' } });
    fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'A forgotten stronghold' } });
    fireEvent.change(screen.getByLabelText('Текст материала'), { target: { value: 'Its halls are silent.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => expect(shared.onCreated).toHaveBeenCalledTimes(1));
    expect(shared.api.createWorldMaterial).toHaveBeenCalledTimes(1);
    expect(shared.api.createWorldMaterial).toHaveBeenCalledWith(4, 'lore', {
      requestId,
      title: 'The Old Keep',
      description: 'A forgotten stronghold',
      tags: [],
      body: 'Its halls are silent.',
    });
    expect(shared.api.createWorldMaterial.mock.calls[0][2]).not.toHaveProperty('isPublished');
    expect(shared.api.updateWorldMaterial).toHaveBeenCalledWith(4, 'lore', 'material-1', {
      title: 'The Old Keep',
      description: 'A forgotten stronghold',
      tags: [],
      isPublished: true,
      expectedRevision: 7,
    });
    expect(shared.api.updateWorldMaterial).toHaveBeenCalledTimes(1);
    expect(shared.onCreated).toHaveBeenCalledWith(publishedMaterial, {
      body: 'Its halls are silent.',
      bodyVersion: 'body-v3',
    });
    vi.restoreAllMocks();
  });
});
