import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@tdn/shared';
import { CampaignApiError, createCampaignApi, runCreation } from './api';
import { parseJson } from './json';

function harness(responses: Response[]) {
  const calls: [string, RequestInit | undefined][] = [];
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    calls.push([url, options]);
    const response = responses.shift();
    if (!response) throw new Error('unexpected request');
    return response;
  }) as unknown as AuthenticatedRequest;
  return { api: createCampaignApi(request), calls, request };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('campaign typed client', () => {
  it('uses campaign root arrays and GUID path segments without parsing identifiers', async () => {
    const { api, calls } = harness([json([]), json({ id: 'a/b', key: 'k', campaignId: 3, name: 'N', metadataRevision: 1 })]);
    await api.listCampaigns();
    await api.getTemplate(3, 'a/b');
    expect(calls[0][0]).toBe('/api/campaigns');
    expect(calls[1][0]).toBe('/api/campaigns/3/templates/a%2Fb');
  });

  it('parses response text losslessly and accepts 201 responses without Location', async () => {
    const { api } = harness([new Response('{"id":2,"name":"x","metadataRevision":9223372036854775807}', { status: 201 })]);
    const result = await api.createCampaign({ name: 'x', requestId: 'req' });
    expect(String(result.metadataRevision)).toBe('9223372036854775807');
  });

  it('does not parse 204 and serializes revisions as numeric JSON', async () => {
    const { api, calls } = harness([new Response(null, { status: 204 }), json({ contentRevision: 1 })]);
    await api.deleteMember(1, 2, parseJson('9223372036854775807') as any);
    await api.putDescription(1, 'char', { description: '', expectedRevision: parseJson('9223372036854775807') as any });
    expect(calls[0][0]).toContain('expectedRevision=9223372036854775807');
    expect(calls[1][1]?.body).toContain('"expectedRevision":9223372036854775807');
  });

  it('sets no-store on permissions and encodes query values', async () => {
    const { api, calls } = harness([json({ canRead: true, canWrite: false, canManageAccess: false }), json({})]);
    await api.campaignPermissions(8);
    await api.getViewSources(8, 'view-guid', 'char-guid');
    expect(calls[0][1]?.cache).toBe('no-store');
    expect(calls[1][0]).toContain('characterId=char-guid');
  });

  it('rejects malformed successful JSON, marking unsafe outcomes uncertain', async () => {
    const malformedRead = harness([new Response('{bad', { status: 200 })]);
    await expect(malformedRead.api.getCampaign(1)).rejects.toMatchObject({ problem: { code: 'invalid_response' }, unknownOutcome: false });
    const malformedWrite = harness([new Response('', { status: 201 })]);
    await expect(malformedWrite.api.createCampaign({ name: 'x', requestId: 'id' })).rejects.toMatchObject({ problem: { code: 'invalid_response' }, unknownOutcome: true });
  });

  it('uses exact character and effective base field response shapes', async () => {
    const effectiveField = { id: 'f', key: 'hp', title: 'HP', description: '', valueType: 'Integer', typeRevision: 1, options: [], effectiveValue: 0, isExplicit: false };
    const character = { id: 'char', campaignId: 1, templateId: 'tpl', name: 'Hero', importance: 'Key', metadataRevision: 1 };
    const { api } = harness([json(character), json({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [effectiveField] })]);
    expect(await api.getCharacter(1, 'char')).not.toHaveProperty('key');
    const sheet = await api.getSheet(1, 'char');
    expect(sheet.baseFields[0]).toHaveProperty('effectiveValue', 0);
    expect(sheet.baseFields[0]).not.toHaveProperty('value');
  });

  it('distinguishes authorization errors and conflicts', async () => {
    const { api } = harness([json({ code: 'unauthorized', title: 'Unauthorized', detail: 'no' }, 401)]);
    await expect(api.getCampaign(1)).rejects.toMatchObject({ status: 401 });
    const conflict = harness([json({ code: 'revision_conflict', title: 'Conflict', detail: 'changed' }, 409)]);
    await expect(conflict.api.renameCampaign(1, { name: 'n', expectedRevision: 1 })).rejects.toMatchObject({ conflict: true, unknownOutcome: false });
  });

  it('reconciles unknown create outcomes with one lookup and does not repost', async () => {
    const uncertain = new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'network' }, true);
    const create = vi.fn().mockRejectedValue(uncertain);
    const lookup = vi.fn().mockResolvedValue({ id: 1 });
    await expect(runCreation(create, lookup)).resolves.toEqual({ id: 1 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    const unavailable = vi.fn().mockRejectedValue(new Error('lookup failed'));
    await expect(runCreation(create, unavailable)).rejects.toBe(uncertain);
  });
});
