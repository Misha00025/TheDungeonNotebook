import { makeAuthenticatedRequest } from '@tdn/shared';
import type { AuthenticatedRequest } from '@tdn/shared';
import { parseJson, stringifyJson } from './json';
import type { Assignment, BaseFieldInput, Campaign, CharacterMetadata, CharacterSheetEnvelope, ComputedSheet, ContentRevisionDto, DefinitionCreate, DefinitionMetadata, FormulaContent, FormulaContentEnvelope, FormulaMetadata, Importance, JsonValue, Member, OverridesEnvelope, Permissions, PresentationEnvelope, ResolvedPresentation, TemplateContentEnvelope, TemplateMetadata, User, ViewContentEnvelope, ViewMetadata, ViewNode, ViewSourcesResponse, VirtualFieldInput, VirtualFieldsEnvelope } from './types';
import type { CatalogAttributeSchemaEnvelope, CatalogContentEnvelope, CatalogCreateRequest, CatalogCreateResult, CatalogCreateResultDto, CatalogGroupConfigurationEnvelope, CatalogGroupEntriesDto, CatalogGroupInput, CatalogGroupsEnvelope, CatalogKind, CatalogMetadata, CatalogMetadataDto, CharacterCatalogAddRequest, CharacterCatalogAddResponse, CharacterCatalogAdditionDto, CharacterCatalogAttributesUpdateRequest, CharacterCatalogCreateRequest, CharacterCatalogEntryDto, CharacterCatalogEntryEnvelope, CharacterCatalogQuantityUpdateRequest } from './catalogTypes';

export interface Problem { code: string; title: string; detail: string; errors?: Record<string, string[]>; resourceId?: string; requestId?: string }
export class CampaignApiError extends Error {
  readonly conflict: boolean;
  readonly unknownOutcome: boolean;
  constructor(readonly status: number, readonly problem: Problem, unknownOutcome = false) {
    super(problem.detail || problem.title);
    this.name = 'CampaignApiError';
    this.conflict = status === 409;
    this.unknownOutcome = unknownOutcome;
  }
}

type Id = string;
type RevisionPayload = { expectedRevision: number | import('lossless-json').LosslessNumber };
const enc = (v: string | number) => encodeURIComponent(String(v));

export function createCampaignApi(request: AuthenticatedRequest) {
  const root = '/api/campaigns';
  async function send<T>(path: string, method = 'GET', body?: unknown, query?: Record<string, string | number>, noStore = false): Promise<T> {
    const qs = query ? new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString() : '';
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await request(`${root}${path}${qs ? `?${qs}` : ''}`, { method, headers, ...(noStore ? { cache: 'no-store' } : {}), ...(body === undefined ? {} : { body: stringifyJson(body) }) });
    } catch (error) {
      if (method !== 'GET') throw new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown outcome', detail: error instanceof Error ? error.message : String(error) }, true);
      throw error;
    }
    if (response.status === 204) return undefined as T;
    let text: string;
    try { text = await response.text(); } catch (error) {
      if (method !== 'GET') throw new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown outcome', detail: error instanceof Error ? error.message : String(error) }, true);
      throw new CampaignApiError(response.status, { code: 'invalid_response', title: 'Invalid response', detail: 'Response body could not be read.' });
    }
    let parsed: unknown;
    try { parsed = text ? parseJson(text) : undefined; } catch { parsed = undefined; }
    if (!response.ok) {
      const value = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
      const p: Problem = { code: String(value.code ?? (response.status === 409 ? 'conflict' : 'http_error')), title: String(value.title ?? response.statusText), detail: String(value.detail ?? response.statusText) };
      if (value.errors && typeof value.errors === 'object') p.errors = value.errors as Record<string, string[]>;
      if (value.resourceId !== undefined) p.resourceId = String(value.resourceId);
      if (value.requestId !== undefined) p.requestId = String(value.requestId);
      const uncertainCode = ['write_outcome_unknown', 'publication_outcome_unknown', 'content_write_outcome_unknown', 'unknown_outcome'].includes(p.code);
      const uncertainGateway = response.status === 502 || response.status === 504;
      throw new CampaignApiError(response.status, p, method !== 'GET' && (uncertainCode || uncertainGateway));
    }
    if (parsed === undefined) throw new CampaignApiError(response.status, { code: 'invalid_response', title: 'Invalid response', detail: 'Expected a JSON response body.' }, method !== 'GET');
    return parsed as T;
  }
  const c = (id: number) => `/${enc(id)}`;
  const template = (id: number) => `${c(id)}/template`;
  const characters = (id: number) => `${c(id)}/characters`;
  const formulas = (id: number) => `${c(id)}/formulas`;
  const views = (id: number) => `${c(id)}/views`;
  const catalog = (id: number, kind: CatalogKind) => `${c(id)}/catalog/${kind === 'Item' ? 'items' : 'skills'}`;
  const characterEntries = (id: number, characterId: Id, kind: CatalogKind) => `${characters(id)}/${enc(characterId)}/${kind === 'Item' ? 'items' : 'skills'}`;
  const enrichMetadata = (metadata: CatalogMetadataDto, kind: CatalogKind): CatalogMetadata => ({ ...metadata, kind });
  const enrichCharacterEntry = (entry: CharacterCatalogEntryDto, kind: CatalogKind): CharacterCatalogEntryEnvelope => ({ ...entry, definition: enrichMetadata(entry.definition, kind) });
  const enrichCharacterResponse = (response: { requestId: string; entry: CharacterCatalogEntryDto }, kind: CatalogKind): CharacterCatalogAddResponse => ({ ...response, entry: enrichCharacterEntry(response.entry, kind) });
  const wireOccurrences = (attributes: import('./catalogTypes').CatalogAttributeOccurrence[]) => attributes.map(({ id, attributeId, value, editLevel }) => ({ id, attributeId, value, editLevel }));
  const wireCondition = (condition: import('./catalogTypes').CatalogGroupInput['condition']): import('./catalogTypes').CatalogGroupInput['condition'] => condition ? ({
    operator: condition.operator,
    ...(condition.attributeId === undefined ? {} : { attributeId: condition.attributeId }),
    ...('value' in condition && condition.value !== undefined ? { value: condition.value } : {}),
    ...('children' in condition && condition.children ? { children: condition.children.map(child => wireCondition(child)!) } : {}),
  }) : null;
  const put = <T>(path: string, body: unknown) => send<T>(path, 'PUT', body);
  const create = <T>(path: string, body: unknown) => send<T>(path, 'POST', body);
  const revQuery = (expectedRevision: RevisionPayload['expectedRevision']) => ({ expectedRevision: String(expectedRevision) });
  return {
    listCampaigns: () => send<Campaign[]>(''),
    getCampaign: (id: number) => send<Campaign>(c(id)),
    createCampaign: (body: { name: string; requestId: Id; administratorUserId?: number }) => create<Campaign>('', body),
    creationStatus: (requestId: Id) => send<{ requestId: Id; resourceId: number }>(`/creation/${enc(requestId)}`),
    renameCampaign: (id: number, body: { name: string; expectedRevision: RevisionPayload['expectedRevision'] }) => put<Campaign>(c(id), body),
    campaignPermissions: (id: number) => send<Permissions>(`${c(id)}/permissions`, 'GET', undefined, undefined, true),
    listMembers: (id: number) => send<Member[]>(`${c(id)}/members`),
    putMember: (id: number, userId: number, body: { isAdmin: boolean; expectedRevision: RevisionPayload['expectedRevision'] }) => put<Member>(`${c(id)}/members/${enc(userId)}`, body),
    deleteMember: (id: number, userId: number, expectedRevision: RevisionPayload['expectedRevision']) => send<void>(`${c(id)}/members/${enc(userId)}`, 'DELETE', undefined, revQuery(expectedRevision)),
    getTemplate: (id: number) => send<TemplateMetadata>(template(id)),
    renameTemplate: (id: number, body: { name: string; expectedRevision: RevisionPayload['expectedRevision'] }) => put<TemplateMetadata>(template(id), body),
    getTemplateContent: (id: number) => send<TemplateContentEnvelope>(`${template(id)}/content`),
    putTemplateContent: (id: number, body: { expectedRevision: RevisionPayload['expectedRevision']; description: string; baseFields: BaseFieldInput[] }) => put<TemplateContentEnvelope>(`${template(id)}/content`, body),
    getTemplateVirtualFields: (id: number) => send<VirtualFieldsEnvelope>(`${template(id)}/virtual-fields`),
    putTemplateVirtualFields: (id: number, body: { expectedRevision: RevisionPayload['expectedRevision']; virtualFields: VirtualFieldInput[] }) => put<VirtualFieldsEnvelope>(`${template(id)}/virtual-fields`, body),
    listCharacters: (id: number) => send<CharacterMetadata[]>(characters(id)),
    getCharacter: (id: number, charId: Id) => send<CharacterMetadata>(`${characters(id)}/${enc(charId)}`),
    createCharacter: (id: number, body: { requestId: Id; name: string; importance?: Importance }) => create<CharacterMetadata>(characters(id), body),
    putCharacter: (id: number, charId: Id, body: { name: string; importance: Importance; expectedRevision: RevisionPayload['expectedRevision'] }) => put<CharacterMetadata>(`${characters(id)}/${enc(charId)}`, body),
    characterPermissions: (id: number, charId: Id) => send<Permissions>(`${characters(id)}/${enc(charId)}/permissions`, 'GET', undefined, undefined, true),
    getSheet: (id: number, charId: Id) => send<CharacterSheetEnvelope>(`${characters(id)}/${enc(charId)}/sheet`),
    getComputedSheet: (id: number, charId: Id) => send<ComputedSheet>(`${characters(id)}/${enc(charId)}/computed-sheet`),
    putDescription: (id: number, charId: Id, body: { description: string; expectedRevision: RevisionPayload['expectedRevision'] }) => put<ContentRevisionDto>(`${characters(id)}/${enc(charId)}/description`, body),
    putBaseValue: (id: number, charId: Id, fieldId: Id, body: { value: JsonValue; expectedRevision: RevisionPayload['expectedRevision'] }) => put<CharacterSheetEnvelope>(`${characters(id)}/${enc(charId)}/base-values/${enc(fieldId)}`, body),
    resetBaseValue: (id: number, charId: Id, fieldId: Id, expectedRevision: RevisionPayload['expectedRevision']) => send<CharacterSheetEnvelope>(`${characters(id)}/${enc(charId)}/base-values/${enc(fieldId)}`, 'DELETE', undefined, revQuery(expectedRevision)),
    getCustomVirtualFields: (id: number, charId: Id) => send<VirtualFieldsEnvelope>(`${characters(id)}/${enc(charId)}/custom-virtual-fields`),
    putCustomVirtualFields: (id: number, charId: Id, body: { expectedRevision: RevisionPayload['expectedRevision']; virtualFields: VirtualFieldInput[] }) => put<VirtualFieldsEnvelope>(`${characters(id)}/${enc(charId)}/custom-virtual-fields`, body),
    getOverrides: (id: number, charId: Id) => send<OverridesEnvelope>(`${characters(id)}/${enc(charId)}/virtual-overrides`),
    putOverride: (id: number, charId: Id, fieldId: Id, body: { expression: string; expectedRevision: RevisionPayload['expectedRevision'] }) => put<ContentRevisionDto>(`${characters(id)}/${enc(charId)}/virtual-overrides/${enc(fieldId)}`, body),
    resetOverride: (id: number, charId: Id, fieldId: Id, expectedRevision: RevisionPayload['expectedRevision']) => send<ContentRevisionDto>(`${characters(id)}/${enc(charId)}/virtual-overrides/${enc(fieldId)}`, 'DELETE', undefined, revQuery(expectedRevision)),
    listAssignments: (id: number, charId: Id) => send<Assignment[]>(`${characters(id)}/${enc(charId)}/assignments`),
    putAssignment: (id: number, charId: Id, userId: number, body: { canWrite: boolean; expectedRevision: RevisionPayload['expectedRevision'] }) => put<Assignment>(`${characters(id)}/${enc(charId)}/assignments/${enc(userId)}`, body),
    deleteAssignment: (id: number, charId: Id, userId: number, expectedRevision: RevisionPayload['expectedRevision']) => send<void>(`${characters(id)}/${enc(charId)}/assignments/${enc(userId)}`, 'DELETE', undefined, revQuery(expectedRevision)),
    listFormulas: (id: number) => send<FormulaMetadata[]>(formulas(id)),
    getFormula: (id: number, formulaId: Id) => send<FormulaMetadata>(`${formulas(id)}/${enc(formulaId)}`),
    createFormula: (id: number, body: { requestId: Id; name: string; expression: string; parameters: string[] }) => create<DefinitionCreate>(formulas(id), body),
    renameFormula: (id: number, formulaId: Id, body: { name: string; expectedRevision: RevisionPayload['expectedRevision'] }) => put<FormulaMetadata>(`${formulas(id)}/${enc(formulaId)}`, body),
    getFormulaContent: (id: number, formulaId: Id) => send<FormulaContentEnvelope>(`${formulas(id)}/${enc(formulaId)}/content`),
    putFormulaContent: (id: number, formulaId: Id, body: FormulaContent & RevisionPayload) => put<FormulaContentEnvelope>(`${formulas(id)}/${enc(formulaId)}/content`, body),
    listViews: (id: number) => send<ViewMetadata[]>(views(id)),
    getView: (id: number, viewId: Id) => send<ViewMetadata>(`${views(id)}/${enc(viewId)}`),
    createView: (id: number, body: { requestId: Id; name: string; roots: ViewNode[] }) => create<DefinitionCreate>(views(id), body),
    renameView: (id: number, viewId: Id, body: { name: string; expectedRevision: RevisionPayload['expectedRevision'] }) => put<ViewMetadata>(`${views(id)}/${enc(viewId)}`, body),
    getViewContent: (id: number, viewId: Id) => send<ViewContentEnvelope>(`${views(id)}/${enc(viewId)}/content`),
    putViewContent: (id: number, viewId: Id, body: { expectedRevision: RevisionPayload['expectedRevision']; roots: ViewNode[] }) => put<ViewContentEnvelope>(`${views(id)}/${enc(viewId)}/content`, body),
    getViewSources: (id: number, viewId: Id, charId: Id) => send<ViewSourcesResponse>(`${views(id)}/${enc(viewId)}/sources`, 'GET', undefined, { characterId: charId }),
    getPresentation: (id: number) => send<PresentationEnvelope>(`${c(id)}/presentation`),
    putPresentation: (id: number, body: { expectedRevision: RevisionPayload['expectedRevision']; defaults: Record<string, string>; contextParams: Record<string, JsonValue> }) => put<PresentationEnvelope>(`${c(id)}/presentation`, body),
    resolvePresentation: (id: number, contextKey: string) => send<ResolvedPresentation>(`${c(id)}/presentation/resolve`, 'GET', undefined, { contextKey }),
    listCatalog: async (id: number, kind: CatalogKind) => (await send<CatalogMetadataDto[]>(catalog(id, kind))).map(entry => enrichMetadata(entry, kind)),
    getCatalogEntry: async (id: number, kind: CatalogKind, entryId: Id) => enrichMetadata(await send<CatalogMetadataDto>(`${catalog(id, kind)}/${enc(entryId)}`), kind),
    getCatalogContent: (id: number, kind: CatalogKind, entryId: Id) => send<CatalogContentEnvelope>(`${catalog(id, kind)}/${enc(entryId)}/content`),
    createCatalogEntry: async (id: number, kind: CatalogKind, body: CatalogCreateRequest) => {
      const result = await create<CatalogCreateResultDto>(catalog(id, kind), {
        requestId: body.requestId,
        name: body.name,
        isHidden: body.isHidden,
        ...(body.quantityUnit === undefined ? {} : { quantityUnit: body.quantityUnit }),
        allowNegative: body.allowNegative,
        description: body.description,
        attributes: wireOccurrences(body.attributes),
      });
      return { ...result, entry: enrichMetadata(result.entry, kind) };
    },
    putCatalogMetadata: async (id: number, kind: CatalogKind, entryId: Id, body: { name: string; expectedRevision: RevisionPayload['expectedRevision']; isHidden?: boolean; quantityUnit?: string | null; allowNegative?: boolean }) => enrichMetadata(await put<CatalogMetadataDto>(`${catalog(id, kind)}/${enc(entryId)}`, {
      name: body.name,
      expectedRevision: body.expectedRevision,
      ...(body.isHidden === undefined ? {} : { isHidden: body.isHidden }),
      ...(body.quantityUnit === undefined ? {} : { quantityUnit: body.quantityUnit }),
      ...(body.allowNegative === undefined ? {} : { allowNegative: body.allowNegative }),
    }), kind),
    putCatalogContent: (id: number, kind: CatalogKind, entryId: Id, body: { expectedRevision: RevisionPayload['expectedRevision']; description: string; attributes: import('./catalogTypes').CatalogAttributeOccurrence[] }) => put<CatalogContentEnvelope>(`${catalog(id, kind)}/${enc(entryId)}/content`, { expectedRevision: body.expectedRevision, description: body.description, attributes: wireOccurrences(body.attributes) }),
    getCatalogAttributes: (id: number, kind: CatalogKind) => send<CatalogAttributeSchemaEnvelope>(`${catalog(id, kind)}/attributes`),
    putCatalogAttributes: (id: number, kind: CatalogKind, body: { expectedRevision: RevisionPayload['expectedRevision']; definitions: import('./catalogTypes').CatalogAttributeInput[] }) => put<CatalogAttributeSchemaEnvelope>(`${catalog(id, kind)}/attributes`, { expectedRevision: body.expectedRevision, definitions: body.definitions.map(({ id: attributeId, title, typeKey, options }) => ({ ...(attributeId ? { id: attributeId } : {}), title, typeKey, options })) }),
    getCatalogGroups: (id: number, kind: CatalogKind) => send<CatalogGroupsEnvelope>(`${catalog(id, kind)}/groups`),
    getCatalogGroupConfiguration: (id: number, kind: CatalogKind) => send<CatalogGroupConfigurationEnvelope>(`${catalog(id, kind)}/groups/configuration`),
    putCatalogGroups: (id: number, kind: CatalogKind, body: { expectedRevision: RevisionPayload['expectedRevision']; groups: CatalogGroupInput[] }) => put<CatalogGroupConfigurationEnvelope>(`${catalog(id, kind)}/groups`, { expectedRevision: body.expectedRevision, groups: body.groups.map(({ id: groupId, title, parentId, entryIds, condition }) => ({ ...(groupId ? { id: groupId } : {}), title, parentId, entryIds, condition: wireCondition(condition) })) }),
    getCatalogGroupEntries: async (id: number, kind: CatalogKind, groupId: Id) => {
      const result = await send<CatalogGroupEntriesDto>(`${catalog(id, kind)}/groups/${enc(groupId)}/entries`);
      return { ...result, entries: result.entries.map(entry => enrichMetadata(entry, kind)) };
    },
    listCharacterEntries: async (id: number, kind: CatalogKind, characterId: Id) => (await send<CharacterCatalogEntryDto[]>(characterEntries(id, characterId, kind))).map(entry => enrichCharacterEntry(entry, kind)),
    getCharacterEntry: async (id: number, kind: CatalogKind, characterId: Id, entryId: Id) => enrichCharacterEntry(await send<CharacterCatalogEntryDto>(`${characterEntries(id, characterId, kind)}/${enc(entryId)}`), kind),
    addCharacterEntry: async (id: number, kind: CatalogKind, characterId: Id, body: CharacterCatalogAddRequest) => enrichCharacterResponse(await create<{ requestId: string; entry: CharacterCatalogEntryDto }>(characterEntries(id, characterId, kind), {
      requestId: body.requestId,
      catalogEntryId: body.catalogEntryId,
      ...(body.quantity === undefined ? {} : { quantity: body.quantity }),
      attributes: wireOccurrences(body.attributes),
    }), kind),
    createOwnCharacterEntry: async (id: number, kind: CatalogKind, characterId: Id, body: CharacterCatalogCreateRequest) => enrichCharacterResponse(await create<{ requestId: string; entry: CharacterCatalogEntryDto }>(`${characterEntries(id, characterId, kind)}/create`, {
      requestId: body.requestId,
      definition: {
        name: body.definition.name,
        isHidden: body.definition.isHidden,
        ...(body.definition.quantityUnit === undefined ? {} : { quantityUnit: body.definition.quantityUnit }),
        allowNegative: body.definition.allowNegative,
        description: body.definition.description,
        attributes: wireOccurrences(body.definition.attributes),
      },
      ...(body.quantity === undefined ? {} : { quantity: body.quantity }),
      attributes: wireOccurrences(body.attributes),
    }), kind),
    getCharacterAddition: (id: number, kind: CatalogKind, characterId: Id, requestId: Id) => send<CharacterCatalogAdditionDto>(`${characterEntries(id, characterId, kind)}/additions/${enc(requestId)}`),
    putCharacterEntryQuantity: async (id: number, characterId: Id, entryId: Id, body: CharacterCatalogQuantityUpdateRequest) => enrichCharacterEntry(await put<CharacterCatalogEntryDto>(`${characters(id)}/${enc(characterId)}/items/${enc(entryId)}/quantity`, body), 'Item'),
    putCharacterEntryAttributes: async (id: number, kind: CatalogKind, characterId: Id, entryId: Id, body: CharacterCatalogAttributesUpdateRequest) => enrichCharacterEntry(await put<CharacterCatalogEntryDto>(`${characterEntries(id, characterId, kind)}/${enc(entryId)}/attributes`, { expectedRevision: body.expectedRevision, attributes: wireOccurrences(body.attributes) }), kind),
    deleteCharacterEntry: (id: number, kind: CatalogKind, characterId: Id, entryId: Id, expectedRevision: RevisionPayload['expectedRevision']) => send<void>(`${characterEntries(id, characterId, kind)}/${enc(entryId)}`, 'DELETE', undefined, revQuery(expectedRevision)),
    searchUsers: async (nickname: string) => {
      const r = await request(`/users?nickname=${encodeURIComponent(nickname)}`);
      if (!r.ok) throw new CampaignApiError(r.status, { code: 'http_error', title: r.statusText, detail: r.statusText });
      return (await r.json() as { users: User[] }).users;
    },
    getUser: async (userId: number) => {
      const r = await request(`/users/${enc(userId)}`);
      if (!r.ok) throw new CampaignApiError(r.status, { code: 'http_error', title: r.statusText, detail: r.statusText });
      return await r.json() as User;
    }
  };
}

export async function runCreation<T>(create: () => Promise<T>, lookup: () => Promise<T>): Promise<T> {
  try { return await create(); } catch (error) {
    const e = error as CampaignApiError;
    const duplicate = e instanceof CampaignApiError && ['creation_already_published', 'already_published', 'content_already_prepared'].includes(e.problem.code);
    if (!duplicate && !(e instanceof CampaignApiError && e.unknownOutcome)) throw error;
    try { return await lookup(); } catch { throw error; }
  }
}

export const campaignApi = createCampaignApi(makeAuthenticatedRequest);
