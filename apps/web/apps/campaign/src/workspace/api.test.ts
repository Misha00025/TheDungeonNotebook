import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@tdn/shared';
import { CampaignApiError, createCampaignApi, runCreation } from './api';
import { parseJson } from './json';
import type { WidgetSource } from './types';

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
    const { api, calls } = harness([json([]), json({ id: 'a/b', campaignId: 3, name: 'N', importance: 'Key', metadataRevision: 1 })]);
    await api.listCampaigns();
    await api.getCharacter(3, 'a/b');
    expect(calls[0][0]).toBe('/api/campaigns');
    expect(calls[1][0]).toBe('/api/campaigns/3/characters/a%2Fb');
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
    const character = { id: 'char', campaignId: 1, name: 'Hero', importance: 'Key', metadataRevision: 1 };
    const { api } = harness([json(character), json({ contentRevision: 1, templateContentRevision: 1, description: '', baseFields: [effectiveField] })]);
    expect(await api.getCharacter(1, 'char')).not.toHaveProperty('key');
    const sheet = await api.getSheet(1, 'char');
    expect(sheet.baseFields[0]).toHaveProperty('effectiveValue', 0);
    expect(sheet.baseFields[0]).not.toHaveProperty('value');
  });

  it('uses singleton template metadata, content, and virtual-field routes and payloads', async () => {
    const metadata = { campaignId: 7, name: 'Campaign', metadataRevision: 1 };
    const content = { campaignId: 7, contentRevision: 0, data: { description: '', baseFields: [], virtualFields: [] } };
    const virtualFields = { contentRevision: 1, virtualFields: [] };
    const { api, calls } = harness([json(metadata), json(metadata), json(content), json(content), json(virtualFields), json(virtualFields)]);
    const fetchedMetadata = await api.getTemplate(7);
    expect(fetchedMetadata).not.toHaveProperty('id');
    expect(fetchedMetadata).not.toHaveProperty('key');
    await api.renameTemplate(7, { name: 'Renamed', expectedRevision: 1 });
    const initial = await api.getTemplateContent(7);
    expect(initial.contentRevision).toBe(0);
    expect(initial).not.toHaveProperty('resourceId');
    expect(initial).not.toHaveProperty('id');
    expect(initial).not.toHaveProperty('key');
    await api.putTemplateContent(7, { expectedRevision: 0, description: '', baseFields: [] });
    await api.getTemplateVirtualFields(7);
    await api.putTemplateVirtualFields(7, { expectedRevision: 1, virtualFields: [] });
    expect(calls.map(([url]) => url)).toEqual([
      '/api/campaigns/7/template',
      '/api/campaigns/7/template',
      '/api/campaigns/7/template/content',
      '/api/campaigns/7/template/content',
      '/api/campaigns/7/template/virtual-fields',
      '/api/campaigns/7/template/virtual-fields'
    ]);
    expect(JSON.parse(calls[1][1]?.body as string)).toEqual({ name: 'Renamed', expectedRevision: 1 });
    expect(JSON.parse(calls[3][1]?.body as string)).toEqual({ expectedRevision: 0, description: '', baseFields: [] });
    expect(JSON.parse(calls[3][1]?.body as string).expectedRevision).toBe(0);
    expect(JSON.parse(calls[5][1]?.body as string)).toEqual({ expectedRevision: 1, virtualFields: [] });
    expect(calls.map(([, options]) => options?.method ?? 'GET')).toEqual(['GET', 'PUT', 'GET', 'PUT', 'GET', 'PUT']);
    expect(api).not.toHaveProperty('listTemplates');
    expect(api).not.toHaveProperty('createTemplate');
  });

  it('creates characters without a template selector with or without importance', async () => {
    const response = { id: 'char', campaignId: 1, name: 'Hero', importance: 'Key', metadataRevision: 1 };
    const { api, calls } = harness([json(response), json(response)]);
    await api.createCharacter(1, { requestId: 'req-1', name: 'Hero' });
    await api.createCharacter(1, { requestId: 'req-2', name: 'Hero', importance: 'Key' });
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ requestId: 'req-1', name: 'Hero' });
    expect(JSON.parse(calls[1][1]?.body as string)).toEqual({ requestId: 'req-2', name: 'Hero', importance: 'Key' });
  });

  it('preserves widget source kinds and classifies template source errors', async () => {
    const source: WidgetSource = { kind: 'Base', fieldId: 'field' };
    const { api, calls } = harness([
      json({ id: 'view', campaignId: 1, name: 'View', metadataRevision: 1 }),
      json({ id: 'view', campaignId: 1, name: 'View', metadataRevision: 1 }),
      json({ code: 'invalid_source', title: 'Invalid source', detail: 'invalid' }, 400),
      json({ code: 'content_revision_conflict', title: 'Conflict', detail: 'stale' }, 409),
      json({ code: 'content_write_outcome_unknown', title: 'Unavailable', detail: 'unknown' }, 503)
    ]);
    await api.createView(1, { requestId: 'req', name: 'View', roots: [{ kind: 'layout', nodeKey: 'root', title: '', params: null, children: [{ kind: 'widget', nodeKey: 'widget', title: '', params: null, children: [], sources: [source], format: '' }] }] });
    await api.putViewContent(1, 'view', { expectedRevision: 1, roots: [{ kind: 'layout', nodeKey: 'root', title: '', params: null, children: [{ kind: 'widget', nodeKey: 'widget', title: '', params: null, children: [], sources: [source], format: '' }] }] });
    for (const call of calls.slice(0, 2)) {
      expect(call[1]?.body).toContain('"kind":"Base"');
      expect(call[1]?.body).toContain('"fieldId":"field"');
      expect(call[1]?.body).not.toContain('templateId');
    }
    await expect(api.getView(1, 'view')).rejects.toMatchObject({ status: 400, problem: { code: 'invalid_source' }, unknownOutcome: false });
    const roots = [{ kind: 'layout' as const, nodeKey: 'root', title: '', params: null, children: [] }];
    await expect(api.putViewContent(1, 'view', { expectedRevision: 1, roots })).rejects.toMatchObject({ status: 409, problem: { code: 'content_revision_conflict' }, conflict: true, unknownOutcome: false });
    await expect(api.putViewContent(1, 'view', { expectedRevision: 1, roots })).rejects.toMatchObject({ status: 503, problem: { code: 'content_write_outcome_unknown' }, unknownOutcome: true });
  });

  it('round-trips native JSON and lossless singleton revisions in content writes', async () => {
    const { api, calls } = harness([json({ campaignId: 7, contentRevision: 9223372036854775807, data: { description: '', baseFields: [], virtualFields: [] } })]);
    await api.putTemplateContent(7, {
      expectedRevision: parseJson('9223372036854775806') as any,
      description: '',
      baseFields: [{ key: 'large', title: 'Large', description: '', valueType: 'Integer', value: parseJson('9007199254740993'), options: [] }]
    });
    const body = String(calls[0][1]?.body);
    expect(body).toContain('"expectedRevision":9223372036854775806');
    expect(body).toContain('"value":9007199254740993');
    expect(body).not.toContain('"value":"9007199254740993"');
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
