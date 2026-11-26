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

  it('creates and reads back a closed location without changing its tag or Markdown body', async () => {
    const requestId = '2e015e8d-6fe2-4a24-8330-b59c6ef01f3a';
    const tag = 'двор, старый рынок';
    const body = '# Старый рынок\n\n## Арка\n\nТекст **без изменений**.\n';
    const materials = new Map<string, WorldMaterial>();
    const bodies = new Map<string, WorldMaterialBody>();
    const request = vi.fn(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      const createPath = '/api/campaigns/42/world/locations';
      if (url === createPath && method === 'POST') {
        const input = JSON.parse(String(options?.body)) as {
          requestId: string;
          title: string;
          description: string;
          tags: string[];
          body: string;
        };
        const material: WorldMaterial = {
          id: input.requestId,
          campaignId: 42,
          kind: 'locations',
          title: input.title,
          description: input.description,
          tags: input.tags,
          isPublished: false,
          metadataRevision: 1,
        };
        const content: WorldMaterialBody = { body: input.body, bodyVersion: 'body-version-1' };
        materials.set(material.id, material);
        bodies.set(material.id, content);
        return new Response(JSON.stringify({ material, bodyVersion: content.bodyVersion }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const materialPath = `${createPath}/${requestId}`;
      if (url === materialPath && method === 'GET') {
        const material = materials.get(requestId);
        if (material) return json(material);
      }
      if (url === `${materialPath}/body` && method === 'GET') {
        const content = bodies.get(requestId);
        if (content) return json(content);
      }
      throw new Error('Unexpected world-material request');
    }) as unknown as AuthenticatedRequest;
    const api = createCampaignApi(request);

    const created = await api.createWorldMaterial(42, 'locations', {
      requestId,
      title: 'Старый рынок',
      description: 'Закрытое место у городской стены.',
      tags: [tag],
      body,
    });
    const material = await api.getWorldMaterial(42, 'locations', created.material.id);
    const content = await api.getWorldBody(42, 'locations', created.material.id);

    expect(material).toEqual({
      id: requestId,
      campaignId: 42,
      kind: 'locations',
      title: 'Старый рынок',
      description: 'Закрытое место у городской стены.',
      tags: [tag],
      isPublished: false,
      metadataRevision: 1,
    });
    expect(material.tags).toEqual(['двор, старый рынок']);
    expect(material.isPublished).toBe(false);
    expect(content).toEqual({ body, bodyVersion: 'body-version-1' });
  });
});
