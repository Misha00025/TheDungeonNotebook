# Singleton-template Web handoff

The campaign service now exposes one canonical template per campaign. This is the client contract handoff; it does not alter BFF transport, sessions, authentication, or request forwarding. The Gateway continues forwarding the verified `X-Subject` and request/response bodies without rewriting them.

## Contract changes

| Before | Now |
| --- | --- |
| Template catalog `GET /api/campaigns/{campaignId}/templates` | Removed; a campaign has one template |
| Template create `POST /api/campaigns/{campaignId}/templates` | Removed; template metadata is created with the campaign |
| Template metadata/content/virtual fields selected by `templateId` | `GET`/`PUT /api/campaigns/{campaignId}/template`, `/template/content`, and `/template/virtual-fields` have no template selector |
| Character creation body selected `templateId` | Character creation takes `requestId`, `name`, and optional `importance`; it uses the campaign's canonical template |
| Character metadata returned `templateId` | Character metadata has no template selector |
| Widget source `{templateId,kind,fieldId}` | Widget source is `{kind,fieldId}` |
| Source outside the selected template could report `not_in_context` | View source validation and projection use only active fields in the campaign's canonical template; invalid definitions return `400 invalid_source`, and removed fields project as `unknown_reference` |

There are no compatibility aliases, redirects, or fallback routes for plural template paths or template GUIDs.

## Examples

Campaign IDs are int32; character and field IDs remain GUIDs. Template metadata has no resource ID or key:

```json
{"campaignId":7,"name":"Campaign","metadataRevision":1}
```

The campaign's SQL template row is created together with the campaign and first administrator. The Mongo content document is optional until edited. A fresh template reads as:

```json
{"campaignId":7,"contentRevision":0,"data":{"description":"","baseFields":[],"virtualFields":[]}}
```

Internally, content uses one document in `campaignTemplates` per campaign; no Mongo resource ID is part of the public contract.

The first `PUT /api/campaigns/7/template/content` or `PUT /api/campaigns/7/template/virtual-fields` uses `expectedRevision: 0` and creates shared content revision `1`. These endpoints share one CAS revision. Later stale writes return `409 content_revision_conflict`. Template metadata rename uses its independent SQL `metadataRevision` starting at `1`.

Character creation no longer names a template:

```json
{"requestId":"4abe7cae-3a0a-42f3-82bf-75347f96daf2","name":"Mira","importance":"Background"}
```

Character metadata likewise has no template selector:

```json
{"id":"4abe7cae-3a0a-42f3-82bf-75347f96daf2","campaignId":7,"name":"Mira","importance":"Background","metadataRevision":1}
```

Example Widget source:

```json
{"kind":"base","fieldId":"97378740-5060-4cc5-91f1-946a7cad3fa4"}
```

Character custom virtual fields and formula overrides remain in that character's own content document and keep their existing revision contract (`expectedRevision >= 1`). They do not select or replace the campaign template.

## Access and errors

Existing permissions continue to apply: global Admin and matching Group can administer the campaign; campaign admins can write template definitions; member definition reads follow `Access:MembersCanReadDefinitions`. Campaign and character access checks remain scoped and are not widened. Gateway/BFF identity and transport contracts are unchanged. Mongo unknown-write outcomes remain safe `503 content_write_outcome_unknown`; revision conflicts remain `409`.

## Web integration touchpoints

The Web implementation is separate. Relevant client files to review are:

- `apps/web/apps/campaign/src/workspace/api.ts` and `types.ts`: endpoint paths and DTO/request types.
- `apps/web/apps/campaign/src/workspace/Templates.tsx`: replace catalog/select/create flow with one campaign-template editor.
- `apps/web/apps/campaign/src/workspace/CreateCharacter.tsx`: remove template selection from creation.
- `apps/web/apps/campaign/src/workspace/CharacterVirtuals.tsx` and `CharacterSheet.tsx`: use the campaign template endpoints/data.
- `apps/web/apps/campaign/src/workspace/ViewTreeEditor.tsx`: persist sources as `{kind,fieldId}` and handle `invalid_source`/`unknown_reference`.
- `apps/web/apps/campaign/src/workspace/Shell.tsx` and `apps/web/apps/campaign/src/App.tsx`: update navigation/state assumptions that depend on a template list or selected template.
- Relevant Web tests include `apps/web/apps/campaign/src/workspace/api.test.ts`, `Templates.test.tsx`, `CreateCharacter.test.tsx`, `CharacterVirtuals.test.tsx`, `CharacterSheet.test.tsx`, `ViewTreeEditor.test.tsx`, and workspace/App tests for navigation. Remove selector assumptions and cover singleton routes and payloads.

Do not select the first item from an old template list: there is no list, and the canonical template is determined by campaign ID. Do not add compatibility aliases or persist template IDs in characters or Widget sources.

## Data migration boundary

Migration `20261118000100_CampaignTemplate` replaces the old many-template SQL structure with shared-primary-key `CampaignTemplates` and seeds an empty named template per campaign. Old template SQL rows and `templateContents` documents are not transferred or used as fallback; downgrade is unsupported. Existing View documents containing `templateId` are not supported by the new source contract and have no promised automatic rewrite. This handoff does not claim that any deployed database has been migrated.

See [templates](templates.md), [characters](characters.md), [formulas](formulas.md), [views](views.md), and the [Gateway contract](gateway.md) for full service semantics.
