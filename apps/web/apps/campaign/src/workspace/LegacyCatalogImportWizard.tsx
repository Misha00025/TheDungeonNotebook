import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Checkbox, DataTable, DataTableCell, ModalPortal, Panel, Select } from '@tdn/shared';
import { CampaignApiError } from './api';
import { ApiError } from './Feedback';
import type { LegacyObject } from './legacyDiscovery';
import type { CatalogAttributeSchemaEnvelope, CatalogAttributeType, CatalogKind } from './catalogTypes';
import { catalogImportOccurrences, discoverCatalogAttributes, metadataForLegacy, schemaInputs } from './legacyCatalogImport';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';

type Props = { items: LegacyObject[]; skills: LegacyObject[]; skillAttributes: LegacyObject[]; campaignId: number; onClose: () => void };
type Kind = CatalogKind;
type SchemaState = Partial<Record<Kind, CatalogAttributeSchemaEnvelope>>;
type Outcome = { kind: string; name: string; status: string };

const kinds: Kind[] = ['Item', 'Skill'];
const label = (kind: Kind) => kind === 'Item' ? 'предмет' : 'навык';

const LegacyCatalogImportWizard: React.FC<Props> = ({ items, skills, skillAttributes, campaignId, onClose }) => {
  const { api, sessionKey } = useWorkspace();
  const { mode, permissions, permissionsLoading, reloadPermissions } = useCampaignWorkspace();
  const canWrite = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  const sources: Record<Kind, LegacyObject[]> = { Item: items, Skill: skills };
  const [selected, setSelected] = useState<Record<Kind, Set<number>>>({ Item: new Set(), Skill: new Set() });
  const [choices, setChoices] = useState<Record<Kind, Record<string, { included: boolean; typeKey: CatalogAttributeType }>>>(() => ({ Item: {}, Skill: {} }));
  const [schemas, setSchemas] = useState<SchemaState>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [failure, setFailure] = useState<unknown>();
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const active = useRef(true);
  const busyRef = useRef(false);
  const picked = (kind: Kind) => [...selected[kind]].sort((a, b) => a - b).map(index => sources[kind][index]).filter((source): source is LegacyObject => Boolean(source));
  const proposalMap = useMemo(() => ({ Item: discoverCatalogAttributes('Item', picked('Item'), []), Skill: discoverCatalogAttributes('Skill', picked('Skill'), skillAttributes) }), [items, skills, skillAttributes, selected]);
  const dirty = Object.values(selected).some(value => value.size > 0) && outcomes.length === 0;
  const clearDirty = useDirtyDraft(`legacy-catalog-import-${sessionKey}-${campaignId}`, dirty);

  const read = async () => {
    if (!canWrite || busyRef.current) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const result = await Promise.all(kinds.filter(kind => sources[kind].length > 0).map(async kind => [kind, await api.getCatalogAttributes(campaignId, kind)] as const));
      if (!active.current) return;
      const next = Object.fromEntries(result) as SchemaState;
      setSchemas(next);
      setBlocked(false);
      setChoices(current => Object.fromEntries(kinds.map(kind => [kind, Object.fromEntries(proposalMap[kind].map(attribute => [attribute.key, current[kind][attribute.key] ?? { included: false, typeKey: attribute.typeKey }]))])) as typeof current);
    } catch (error) {
      if (active.current) {
        setLoadError(error);
        if (error instanceof CampaignApiError && error.status === 403) reloadPermissions();
      }
    } finally {
      if (active.current) setLoading(false);
    }
  };

  useEffect(() => {
    active.current = true;
    void read();
    return () => { active.current = false; };
  }, []);
  useEffect(() => { if (!canWrite) onClose(); }, [canWrite, onClose]);

  const selectedCount = kinds.reduce((total, kind) => total + selected[kind].size, 0);
  const updateSelection = (kind: Kind, index: number, checked: boolean) => setSelected(current => {
    const next = new Set(current[kind]);
    if (checked) next.add(index); else next.delete(index);
    return { ...current, [kind]: next };
  });
  const updateChoice = (kind: Kind, key: string, patch: Partial<{ included: boolean; typeKey: CatalogAttributeType }>) => setChoices(current => {
    const choice = current[kind][key] ?? { included: false, typeKey: 'string' as const };
    return { ...current, [kind]: { ...current[kind], [key]: { ...choice, ...patch } } };
  });

  const importSelected = async () => {
    if (!canWrite || busyRef.current || blocked || selectedCount === 0) return;
    if (!window.confirm('Импортировать выбранные определения предметов и навыков? Назначения персонажам и изображения не импортируются.')) return;
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    const report: Outcome[] = [];
    let stopped = false;
    try {
      for (const kind of kinds) {
        if (stopped) break;
        const selectedSources = picked(kind);
        if (!selectedSources.length) continue;
        let schema = schemas[kind];
        if (!schema) { report.push({ kind, name: 'Схема', status: 'не загружена; определения не обработаны' }); continue; }
        const chosen = proposalMap[kind].filter(item => choices[kind][item.key]?.included);
        const existingCount = schema.data.definitions.length;
        const definitionInputs = schemaInputs(schema.data.definitions, proposalMap[kind], choices[kind]);
        const newChosen = chosen.length > 0;
        const ids = new Map<string, string>();
        if (newChosen) {
          try {
            const updated = await api.putCatalogAttributes(campaignId, kind, { expectedRevision: schema.contentRevision, definitions: definitionInputs });
            schema = updated;
            setSchemas(current => ({ ...current, [kind]: updated }));
            chosen.forEach((attribute, index) => {
              const created = updated.data.definitions[existingCount + index];
              if (created) ids.set(attribute.key, created.id);
            });
            report.push({ kind, name: 'Схема атрибутов', status: 'подтверждена' });
          } catch (error) {
            report.push({ kind, name: 'Схема атрибутов', status: 'не подтверждена; определения этого типа пропущены' });
            setFailure(error);
            if (error instanceof CampaignApiError && error.status === 403) reloadPermissions();
            if (error instanceof CampaignApiError && (error.unknownOutcome || error.conflict || error.status === 0)) { setBlocked(true); stopped = true; }
            continue;
          }
        }
        for (const source of [...selected[kind]].sort((a, b) => a - b).map(index => sources[kind][index])) {
          if (!source) continue;
          const sourceChoices = choices[kind];
            const occurrenceResult = catalogImportOccurrences(kind, source, sourceChoices, ids);
          const requestId = crypto.randomUUID();
          const metadata = metadataForLegacy(kind, source);
          const request = { requestId, ...metadata, description: typeof source.data.description === 'string' ? source.data.description : '', attributes: occurrenceResult.attributes };
          try {
            await api.createCatalogEntry(campaignId, kind, request);
            report.push({ kind, name: source.name, status: `создано${occurrenceResult.issues.length ? `; замечания: ${occurrenceResult.issues.join(' ')}` : ''}` });
          } catch (error) {
            if (error instanceof CampaignApiError && (error.unknownOutcome || error.status === 0 || error.problem.code === 'creation_already_published' || error.problem.code === 'already_published' || error.problem.code === 'content_already_prepared')) {
              try {
                await api.getCatalogEntry(campaignId, kind, requestId);
                await api.getCatalogContent(campaignId, kind, requestId);
                report.push({ kind, name: source.name, status: 'создание подтверждено повторным чтением' });
              } catch (lookupError) {
                report.push({ kind, name: source.name, status: 'результат неизвестен; автоматический повтор запрещён' });
                setFailure(lookupError);
                setBlocked(true);
                stopped = true;
                break;
              }
            } else {
              report.push({ kind, name: source.name, status: 'не создано' });
              setFailure(error);
              if (error instanceof CampaignApiError && error.status === 403) { reloadPermissions(); stopped = true; }
              if (error instanceof CampaignApiError && error.conflict) { setBlocked(true); stopped = true; }
            }
          }
        }
        if (stopped) break;
      }
    } finally {
      if (active.current) {
        setOutcomes(report);
        setBusy(false);
      }
      busyRef.current = false;
    }
  };

  const close = () => {
    if (busyRef.current) return;
    if (dirty && !window.confirm('Выбранные определения ещё не импортированы. Отказаться от выбора?')) return;
    clearDirty();
    onClose();
  };

  return <ModalPortal isOpen onClose={close} title="Импорт определений каталога" size="wide" dismissDisabled={busy}>
    <Panel><p>Импортируются только определения предметов и навыков в каталоги кампании. Назначения персонажам и изображения не импортируются.</p></Panel>
    {loading && <p role="status">Загрузка схем каталогов…</p>}
    {Boolean(loadError) && <><ApiError error={loadError} /><Button type="button" variant="secondary" disabled={busy} onClick={() => void read()}>Повторить чтение</Button></>}
    {blocked && <Panel><p role="alert">После неопределённого результата создание остановлено. Перечитайте состояние перед продолжением; автоматический повтор не выполняется.</p><Button type="button" disabled={busy} onClick={() => void read()}>Перечитать схемы</Button></Panel>}
    {!loading && !loadError && step === 1 && kinds.map(kind => sources[kind].length > 0 && <Panel key={kind} title={kind === 'Item' ? 'Предметы' : 'Навыки'}>
      <Button type="button" variant="secondary" disabled={!canWrite || busy} onClick={() => setSelected(current => ({
        ...current,
        [kind]: current[kind].size === sources[kind].length
          ? new Set()
          : new Set(sources[kind].map((_, index) => index))
      }))}>{selected[kind].size === sources[kind].length ? `Снять выбор ${kind === 'Item' ? 'предметов' : 'навыков'}` : `Выбрать все ${kind === 'Item' ? 'предметы' : 'навыки'}`}</Button>
      <DataTable aria-label={`Определения ${kind === 'Item' ? 'предметов' : 'навыков'} для импорта`}>
        <thead><tr><DataTableCell as="th">Импорт</DataTableCell><DataTableCell as="th">Название</DataTableCell><DataTableCell as="th">Описание</DataTableCell></tr></thead>
        <tbody>{sources[kind].map((source, index) => <tr key={`${source.sourceId ?? source.name}:${index}`}>
          <DataTableCell><Checkbox aria-label={`Импортировать ${label(kind)} ${source.name}`} checked={selected[kind].has(index)} disabled={!canWrite || busy} onChange={event => updateSelection(kind, index, event.target.checked)} /></DataTableCell>
          <DataTableCell as="th" scope="row">{source.name}</DataTableCell><DataTableCell>{typeof source.data.description === 'string' ? source.data.description : '—'}</DataTableCell>
        </tr>)}</tbody>
      </DataTable>
    </Panel>)}
    {!loading && !loadError && step === 2 && kinds.map(kind => {
      const selectedSources = picked(kind);
      if (!selectedSources.length) return null;
      return <Panel key={kind} title={`${kind === 'Item' ? 'Предметы' : 'Навыки'}: атрибуты`}>
        <p>Схема этого типа каталога независима от схемы другого типа. Исключённые атрибуты и их значения не попадут в импорт.</p>
        {proposalMap[kind].length === 0 ? <p>Атрибутов для импорта нет.</p> : <DataTable aria-label={`Атрибуты ${kind === 'Item' ? 'предметов' : 'навыков'}`}>
          <thead><tr><DataTableCell as="th">Импорт</DataTableCell><DataTableCell as="th">Название атрибута</DataTableCell><DataTableCell as="th">Тип</DataTableCell></tr></thead>
          <tbody>{proposalMap[kind].map(attribute => <tr key={attribute.key}>
            <DataTableCell><Checkbox aria-label={`Импортировать атрибут ${attribute.title}`} checked={choices[kind][attribute.key]?.included ?? false} disabled={busy || !canWrite} onChange={event => updateChoice(kind, attribute.key, { included: event.target.checked })} /></DataTableCell>
            <DataTableCell as="th" scope="row">{attribute.title} <small>({attribute.key})</small></DataTableCell>
            <DataTableCell>{attribute.price ? 'integer' : <Select aria-label={`Тип атрибута ${attribute.title}`} value={choices[kind][attribute.key]?.typeKey ?? 'string'} disabled={busy || !canWrite} onChange={event => updateChoice(kind, attribute.key, { typeKey: event.target.value as CatalogAttributeType })}><option value="string">string</option><option value="integer">integer</option><option value="number">number</option><option value="boolean">boolean</option></Select>}</DataTableCell>
          </tr>)}</tbody>
        </DataTable>}
        <p>Цена импортируется как целое число только при включённом атрибуте «Цена»; неподходящие значения будут пропущены.</p>
      </Panel>;
    })}
    {Boolean(failure) && <ApiError error={failure} />}
    {outcomes.length > 0 && <Panel title="Результат импорта"><ul>{outcomes.map((item, index) => <li key={`${item.kind}:${item.name}:${index}`}>{item.kind === 'Item' ? 'Предмет' : item.kind === 'Skill' ? 'Навык' : item.kind}: «{item.name}» — {item.status}</li>)}</ul><p>Импорт выполняется поэтапно; подтверждённые изменения не откатываются при последующей ошибке.</p></Panel>}
    <ActionRow>
      <Button type="button" variant="secondary" disabled={busy} onClick={close}>{outcomes.length ? 'Закрыть' : 'Отмена'}</Button>
      {step === 1
        ? <Button type="button" disabled={!canWrite || loading || Boolean(loadError) || blocked || selectedCount === 0} onClick={() => setStep(2)}>Далее</Button>
        : <><Button type="button" variant="secondary" disabled={busy || outcomes.length > 0} onClick={() => setStep(1)}>Назад</Button><Button type="button" disabled={!canWrite || busy || blocked || outcomes.length > 0} onClick={() => void importSelected()}>{busy ? 'Импорт…' : 'Подтвердить импорт'}</Button></>}
    </ActionRow>
  </ModalPortal>;
};

export default LegacyCatalogImportWizard;
