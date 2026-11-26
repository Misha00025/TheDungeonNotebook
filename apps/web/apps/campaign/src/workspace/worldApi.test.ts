import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@tdn/shared';
import { createCampaignApi } from './api';
import type { WorldMaterial, WorldMaterialBody } from './types';

const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('world materials API', () => {
  it('reads a published location and its Markdown body for a campaign participant', async () => {
    const material: WorldMaterial = {
      id: 'harbor',
      campaignId: 42,
      kind: 'locations',
      title: 'Старый порт',
      description: 'Порт на восточном берегу.',
      tags: ['побережье', 'город'],
      isPublished: true,
      metadataRevision: 3,
    };
    const materialBody: WorldMaterialBody = {
      body: '## Причал\n\nЗдесь начинается путь.\n\n- Северный мол\n- Рыбный рынок',
      bodyVersion: 'body-v1',
    };
    const responses = [json([material]), json(material), json(materialBody)];
    const request = vi.fn(async () => {
      const response = responses.shift();
      if (!response) throw new Error('No response available');
      return response;
    }) as unknown as AuthenticatedRequest;
    const api = createCampaignApi(request);

    const listed = await api.listWorldMaterials(42, 'locations');
    const detail = await api.getWorldMaterial(42, 'locations', material.id);
    const body = await api.getWorldBody(42, 'locations', material.id);

    expect(listed[0]).toEqual({
      title: 'Старый порт',
      description: 'Порт на восточном берегу.',
      tags: ['побережье', 'город'],
      isPublished: true,
      id: 'harbor',
      campaignId: 42,
      kind: 'locations',
      metadataRevision: 3,
    });
    expect(detail).toEqual(material);
    expect(body.body).toBe('## Причал\n\nЗдесь начинается путь.\n\n- Северный мол\n- Рыбный рынок');
  });
});
