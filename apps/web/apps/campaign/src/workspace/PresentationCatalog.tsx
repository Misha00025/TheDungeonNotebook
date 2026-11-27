import React, { createContext, useContext, useId } from 'react';
import { Checkbox, DataTable, DataTableCell, Field, Select, StatePanel } from '@tdn/shared';
import type { CatalogGroupCondition, CatalogKind } from './catalogTypes';
import { CharacterCatalogProvider, CharacterCatalogScope } from './CharacterCatalogContext';
import type { CharacterCatalogProviderProps } from './CharacterCatalogContext';
import CharacterCatalogPanel from './CharacterCatalogPanel';
import CatalogConditionEditor from './CatalogConditionEditor';
import { compileCatalogFilter } from './catalogFilter';
import { useResource } from './hooks';
import { useWorkspace } from './Workspace';
import { ApiError } from './Feedback';

type CatalogViewOptions = {
  campaignId: number;
  audience: 'gm' | 'player';
  characterName?: string;
  canPublishDefinition: boolean;
  definitionPermissionsPending: boolean;
  onDefinitionForbidden?: () => void;
  preview: boolean;
};

const CatalogViewContext = createContext<CatalogViewOptions | undefined>(undefined);

export type PresentationCatalogProviderProps = Omit<CharacterCatalogProviderProps, 'kind'> & {
  audience?: 'gm' | 'player';
  characterName?: string;
  canPublishDefinition?: boolean;
  definitionPermissionsPending?: boolean;
  onDefinitionForbidden?: () => void;
  preview?: boolean;
};

export const PresentationCatalogProvider: React.FC<PresentationCatalogProviderProps> = ({
  campaignId,
  characterId,
  canRead,
  canWrite,
  permissionsPending,
  onForbidden,
  audience = 'player',
  characterName,
  canPublishDefinition = false,
  definitionPermissionsPending = false,
  onDefinitionForbidden,
  preview = false,
  children,
}) => <CatalogViewContext.Provider value={{ campaignId, audience, characterName, canPublishDefinition, definitionPermissionsPending, onDefinitionForbidden, preview }}>
  <CharacterCatalogProvider campaignId={campaignId} characterId={characterId} kind="Item" canRead={canRead} canWrite={preview ? false : canWrite} permissionsPending={permissionsPending} onForbidden={onForbidden}>
    <CharacterCatalogProvider campaignId={campaignId} characterId={characterId} kind="Skill" canRead={canRead} canWrite={preview ? false : canWrite} permissionsPending={permissionsPending} onForbidden={onForbidden}>
      {children}
    </CharacterCatalogProvider>
  </CharacterCatalogProvider>
</CatalogViewContext.Provider>;

export const PresentationCatalog: React.FC<{ kind: CatalogKind; condition: CatalogGroupCondition | null; sample: boolean; attributeIds?: string[] | null }> = ({ kind, condition, sample, attributeIds }) => {
  const options = useContext(CatalogViewContext);
  const { api, sessionKey } = useWorkspace();
  const schema = useResource(
    `${sessionKey}:${options?.campaignId ?? 'none'}:${kind}:layout-preview-schema`,
    () => options ? api.getCatalogAttributes(options.campaignId, kind) : Promise.reject(new Error('Campaign context unavailable')),
    sample && Boolean(options),
  );
  if (sample) {
    const entries = kind === 'Item' ? [{ name: 'Походный набор', quantity: '2' }, { name: 'Факел', quantity: '1' }] : [{ name: 'Выживание' }, { name: 'Наблюдательность' }];
    const definitions = schema.data?.data.definitions ?? [];
    const selectedDefinitions = (attributeIds ?? []).flatMap(id => {
      const definition = definitions.find(item => item.id === id);
      return definition ? [definition] : [];
    });
    const sampleValue = (index: number) => index === 0 ? 'Образец' : 'Пример';
    return <section>
      <p>Образец · Не игровые данные</p>
      {schema.loading && !schema.data && <StatePanel kind="loading">Загрузка схемы атрибутов для предпросмотра…</StatePanel>}
       <DataTable aria-label={kind === 'Item' ? 'Образец инвентаря' : 'Образец навыков'}>
         <thead><tr><DataTableCell as="th" scope="col" sizing="content">Имя</DataTableCell>{selectedDefinitions.map(definition => <DataTableCell key={definition.id} as="th" scope="col">{definition.title}</DataTableCell>)}{kind === 'Item' && <DataTableCell as="th" scope="col" sizing="control">Количество</DataTableCell>}</tr></thead>
         <tbody>{entries.map((entry, rowIndex) => <tr key={entry.name}><DataTableCell as="th" scope="row" sizing="content">{entry.name}</DataTableCell>{selectedDefinitions.map((definition, index) => <DataTableCell key={definition.id}>{sampleValue((rowIndex + index) % 2)}</DataTableCell>)}{'quantity' in entry && <DataTableCell sizing="control">{entry.quantity}</DataTableCell>}</tr>)}</tbody>
        </DataTable>
    </section>;
  }
  if (!options) return <StatePanel kind="empty">Контекст персонажа недоступен.</StatePanel>;
  return <>
    {options.preview && <p role="status">Только просмотр</p>}
    <CharacterCatalogScope key={kind} kind={kind}><CharacterCatalogPanel
    key={kind}
    kind={kind}
    layout
    condition={condition}
    attributeIds={attributeIds}
    readOnly={options.preview}
    preview={options.preview}
    audience={options.audience}
    characterName={options.characterName}
    canPublishDefinition={options.canPublishDefinition}
    definitionPermissionsPending={options.definitionPermissionsPending}
    onDefinitionForbidden={options.onDefinitionForbidden}
    /></CharacterCatalogScope>
  </>;
};

export const PresentationCatalogSettings: React.FC<{
  campaignId: number;
  kind: CatalogKind;
  condition: CatalogGroupCondition | null;
  attributeIds: string[] | null;
  onChange: (patch: { kind?: CatalogKind; condition?: CatalogGroupCondition | null; attributeIds?: string[] | null }) => void;
  disabled: boolean;
  onValidityChange: (invalid: boolean) => void;
}> = ({ campaignId, kind, condition, attributeIds, onChange, disabled, onValidityChange }) => {
  const { api, sessionKey } = useWorkspace();
  const kindFieldId = useId();
  const schema = useResource(`${sessionKey}:${campaignId}:${kind}:layout-catalog-schema`, () => api.getCatalogAttributes(campaignId, kind));
  const compiled = schema.data && condition ? compileCatalogFilter(condition, schema.data.data.definitions) : undefined;
  const changeKind = (next: CatalogKind) => {
    if (next === kind) return;
    if (condition && !window.confirm('При смене раздела условие другого каталога будет сброшено. Продолжить?')) return;
    onChange({ kind: next, condition: null, attributeIds: [] });
  };

  return <div>
    <Field label="Раздел каталога" htmlFor={kindFieldId}>
      <Select variant="single-line" id={kindFieldId} disabled={disabled} value={kind} onChange={event => changeKind(event.target.value as CatalogKind)}>
        <option value="Item">Инвентарь</option>
        <option value="Skill">Навыки</option>
      </Select>
    </Field>
    {schema.loading && !schema.data && <StatePanel kind="loading">Загрузка схемы характеристик…</StatePanel>}
    {Boolean(schema.error) && <ApiError error={schema.error} onRetry={schema.reload} />}
    {schema.data && !schema.error && <>
      <fieldset>
        <legend>Атрибуты</legend>
        {schema.data.data.definitions.map(definition => {
          const selected = (attributeIds ?? []).includes(definition.id);
          return <label key={definition.id}><Checkbox disabled={disabled} checked={selected} onChange={event => {
            const current = attributeIds ?? [];
            onChange({ attributeIds: event.target.checked
              ? [...new Set([...current, definition.id])]
              : current.filter(id => id !== definition.id) });
          }} />{definition.title}</label>;
        })}
      </fieldset>
      {compiled?.error && <p role="status">{compiled.error}</p>}
      <CatalogConditionEditor key={kind} definitions={schema.data.data.definitions} condition={condition} onChange={next => onChange({ condition: next })} disabled={disabled} onValidityChange={onValidityChange} />
    </>}
  </div>;
};
