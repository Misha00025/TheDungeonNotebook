import React, { createContext, useContext, useId } from 'react';
import { Field, List, ListItem, Select, StatePanel } from '@tdn/shared';
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
}) => <CatalogViewContext.Provider value={{ audience, characterName, canPublishDefinition, definitionPermissionsPending, onDefinitionForbidden, preview }}>
  <CharacterCatalogProvider campaignId={campaignId} characterId={characterId} kind="Item" canRead={canRead} canWrite={preview ? false : canWrite} permissionsPending={permissionsPending} onForbidden={onForbidden}>
    <CharacterCatalogProvider campaignId={campaignId} characterId={characterId} kind="Skill" canRead={canRead} canWrite={preview ? false : canWrite} permissionsPending={permissionsPending} onForbidden={onForbidden}>
      {children}
    </CharacterCatalogProvider>
  </CharacterCatalogProvider>
</CatalogViewContext.Provider>;

export const PresentationCatalog: React.FC<{ kind: CatalogKind; condition: CatalogGroupCondition | null; sample: boolean }> = ({ kind, condition, sample }) => {
  const options = useContext(CatalogViewContext);
  if (sample) return <section>
    <p>Образец · Не игровые данные</p>
    <List layout="vertical" stretch gap="small">
      {(kind === 'Item' ? [{ name: 'Походный набор', quantity: '2' }, { name: 'Факел', quantity: '1' }] : [{ name: 'Выживание' }, { name: 'Наблюдательность' }]).map(entry => <ListItem key={entry.name} density="compact" meta={'quantity' in entry ? entry.quantity : undefined}><span>{entry.name}</span></ListItem>)}
    </List>
  </section>;
  if (!options) return <StatePanel kind="empty">Контекст персонажа недоступен.</StatePanel>;
  return <>
    {options.preview && <p role="status">Только просмотр</p>}
    <CharacterCatalogScope key={kind} kind={kind}><CharacterCatalogPanel
    key={kind}
    kind={kind}
    layout
    condition={condition}
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
  onChange: (patch: { kind?: CatalogKind; condition?: CatalogGroupCondition | null }) => void;
  disabled: boolean;
  onValidityChange: (invalid: boolean) => void;
}> = ({ campaignId, kind, condition, onChange, disabled, onValidityChange }) => {
  const { api, sessionKey } = useWorkspace();
  const kindFieldId = useId();
  const schema = useResource(`${sessionKey}:${campaignId}:${kind}:layout-catalog-schema`, () => api.getCatalogAttributes(campaignId, kind));
  const compiled = schema.data && condition ? compileCatalogFilter(condition, schema.data.data.definitions) : undefined;
  const changeKind = (next: CatalogKind) => {
    if (next === kind) return;
    if (condition && !window.confirm('При смене раздела условие другого каталога будет сброшено. Продолжить?')) return;
    onChange({ kind: next, condition: null });
  };

  return <div>
    <Field label="Раздел каталога" htmlFor={kindFieldId}>
      <Select id={kindFieldId} disabled={disabled} value={kind} onChange={event => changeKind(event.target.value as CatalogKind)}>
        <option value="Item">Инвентарь</option>
        <option value="Skill">Навыки</option>
      </Select>
    </Field>
    {schema.loading && !schema.data && <StatePanel kind="loading">Загрузка схемы характеристик…</StatePanel>}
    {Boolean(schema.error) && <ApiError error={schema.error} onRetry={schema.reload} />}
    {schema.data && !schema.error && <>
      {compiled?.error && <p role="status">{compiled.error}</p>}
      <CatalogConditionEditor key={kind} definitions={schema.data.data.definitions} condition={condition} onChange={next => onChange({ condition: next })} disabled={disabled} onValidityChange={onValidityChange} />
    </>}
  </div>;
};
