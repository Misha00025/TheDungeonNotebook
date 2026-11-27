import React, { useLayoutEffect, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, DataTableCell, Field, FileInput, Panel } from '@tdn/shared';
import { useParams } from 'react-router-dom';
import { displayValue } from './json';
import type { JsonValue } from './types';
import { discoverLegacyExport } from './legacyDiscovery';
import type { LegacyDiscovery, LegacyField, LegacyObject, LegacySection } from './legacyDiscovery';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import styles from './Workspace.module.css';
import HeroImportWizard, { HeroImportSummary } from './HeroImportWizard';
import type { HeroImportPlan, HeroImportRun } from './heroImport';
import LegacyTemplateFieldImportWizard from './LegacyTemplateFieldImportWizard';
import LegacyCatalogImportWizard from './LegacyCatalogImportWizard';

const readValue = (data: Record<string, JsonValue>, key: string) => Object.prototype.hasOwnProperty.call(data, key) ? formatValue(data[key]) : 'Не задано';
const formatValue = (value: JsonValue) => value === '' ? 'Пустая строка' : value === null ? 'null' : displayValue(value);
const unsupportedSections = new Set(['skillAttributes']);

const FieldTable: React.FC<{ fields: LegacyField[] }> = ({ fields }) => <DataTable aria-label="Исходные поля">
  <thead><tr><DataTableCell as="th" sizing="content">Название</DataTableCell><DataTableCell as="th" sizing="content">Ключ</DataTableCell><DataTableCell as="th">Значение</DataTableCell><DataTableCell as="th">Формула</DataTableCell><DataTableCell as="th">Формула модификатора</DataTableCell><DataTableCell as="th">Максимум</DataTableCell><DataTableCell as="th">Описание</DataTableCell></tr></thead>
  <tbody>{fields.map((field, index) => <tr key={`${field.key}:${index}`}>
    <DataTableCell as="th" scope="row" sizing="content">{field.name}</DataTableCell><DataTableCell sizing="content">{field.key}</DataTableCell>
    <DataTableCell preserveWhitespace>{readValue(field.data, 'value')}</DataTableCell><DataTableCell preserveWhitespace>{readValue(field.data, 'formula')}</DataTableCell>
    <DataTableCell preserveWhitespace>{readValue(field.data, 'modifierFormula')}</DataTableCell><DataTableCell preserveWhitespace>{readValue(field.data, 'maxValue')}</DataTableCell>
    <DataTableCell preserveWhitespace>{readValue(field.data, 'description')}</DataTableCell>
  </tr>)}</tbody>
</DataTable>;

const ObjectDetails: React.FC<{ object: LegacyObject; sectionKey: string }> = ({ object, sectionKey }) => <details>
  <summary>{object.name}</summary>
  {object.properties.length > 0 && <dl>{object.properties.map((property, index) => <React.Fragment key={`${property.name}:${index}`}><dt>{property.name}</dt><dd>{formatValue(property.value)}</dd></React.Fragment>)}</dl>}
  {object.fields.length > 0 && <>
    <p>Формулы, формулы модификаторов и максимальные значения показаны только как исходный текст и не переносятся.</p>
    <FieldTable fields={object.fields} />
  </>}
  {sectionKey === 'templateSchema' && object.fields.length === 0 && object.properties.length === 0 && <p>Дополнительных свойств нет.</p>}
</details>;

const SectionDetails: React.FC<{ section: LegacySection; sectionIndex: number }> = ({ section, sectionIndex }) => <details>
  <summary>{section.label}{section.objects.length !== section.total ? ` — обнаружено ${section.objects.length} из ${section.total}` : ` — ${section.objects.length}`}</summary>
  {!section.present ? <p>Раздел отсутствует в файле.</p> : section.total === 0 ? <p>Записей нет.</p> : null}
  {section.present && section.objects.length > 0 && unsupportedSections.has(section.key) && <p>Метаданные используются для названий атрибутов навыков; отдельно не импортируются.</p>}
  {section.objects.map((object, objectIndex) => <ObjectDetails key={`${sectionIndex}:${objectIndex}`} object={object} sectionKey={section.key} />)}
</details>;

const Report: React.FC<{ report: LegacyDiscovery; attempted?: boolean }> = ({ report, attempted = false }) => <>
  <Panel>
    <p>Версия: {report.version}</p>
    {report.exportedAt !== undefined && <p>Дата экспорта: {report.exportedAt}</p>}
    <p>{attempted ? 'Показано содержимое файла. Результаты импорта приведены отдельно.' : 'Показано только содержимое файла. Ничего не импортировано.'}</p>
  </Panel>
  <Panel>
    {report.sections.map((section, index) => <SectionDetails key={`${section.key}:${index}`} section={section} sectionIndex={index} />)}
  </Panel>
  {report.unknownSections.length > 0 && <Panel title="Неизвестные разделы"><ul>{report.unknownSections.map((name, index) => <li key={`${name}:${index}`}>{name}</li>)}</ul></Panel>}
  {report.diagnostics.length > 0 && <Panel title="Замечания к файлу"><ul>{report.diagnostics.map((diagnostic, index) => <li key={index}>{diagnostic}</li>)}</ul></Panel>}
</>;

const ScopedLegacyExportDiscovery: React.FC<{ canAnalyze: boolean; campaignId: number }> = ({ canAnalyze, campaignId }) => {
  const [report, setReport] = useState<LegacyDiscovery>();
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templateImportOpen, setTemplateImportOpen] = useState(false);
  const [catalogImportOpen, setCatalogImportOpen] = useState(false);
  const importBusy = importOpen || templateImportOpen || catalogImportOpen;
  const [lastImport, setLastImport] = useState<{ plan: HeroImportPlan; run: HeroImportRun }>();
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const mounted = useRef(true);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { sequence.current += 1; mounted.current = false; };
  }, []);

  useLayoutEffect(() => {
    if (canAnalyze) return;
    sequence.current += 1;
    setReport(undefined);
    setError(undefined);
    setFileName('');
    setBusy(false);
    setImportOpen(false);
    setTemplateImportOpen(false);
    setCatalogImportOpen(false);
    if (input.current) input.current.value = '';
  }, [canAnalyze]);

  const clear = () => {
    if (importBusy) return;
    sequence.current += 1;
    setReport(undefined);
    setError(undefined);
    setFileName('');
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const selectFile = async (file?: File) => {
    if (!canAnalyze || importBusy) return;
    const current = ++sequence.current;
    setReport(undefined);
    setError(undefined);
    setFileName(file?.name ?? '');
    setBusy(Boolean(file));
    if (!file) return;
    let text: string;
    try { text = await file.text(); }
    catch {
      if (mounted.current && sequence.current === current) { setError('Не удалось прочитать файл.'); setBusy(false); }
      return;
    }
    if (!mounted.current || sequence.current !== current) return;
    try {
      setReport(discoverLegacyExport(text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось прочитать файл.');
    } finally {
      if (mounted.current && sequence.current === current) setBusy(false);
    }
  };

  return <section className={styles.page}>
    <p>Файл разбирается в браузере. Данные кампании изменяются только после подтверждения выбранного импорта.</p>
    <Field label="JSON старого экспорта" htmlFor="legacy-export-file">
      <FileInput ref={input} id="legacy-export-file" accept=".json,application/json" disabled={!canAnalyze || importBusy} onChange={event => { void selectFile(event.currentTarget.files?.[0]); }} />
    </Field>
    <ActionRow>
      <Button type="button" variant="secondary" disabled={!canAnalyze || importBusy} onClick={clear}>Очистить</Button>
    </ActionRow>
    {fileName && <p>Файл: {fileName}</p>}
    {busy && <p role="status">Анализ файла…</p>}
    {error && <p role="alert">{error}</p>}
    {report && <Report report={report} attempted={Boolean(lastImport && (lastImport.run.attempted || Object.values(lastImport.run.statuses).includes('unknown')))} />}
    {report && (report.sections.find(section => section.key === 'characters')?.objects.length ?? 0) > 0 && <Button type="button" disabled={!canAnalyze || importBusy} onClick={() => { setTemplateImportOpen(false); setImportOpen(true); }}>Импортировать персонажа</Button>}
    {report && (report.sections.find(section => section.key === 'charlists')?.objects.length ?? 0) > 0 && <Button type="button" disabled={!canAnalyze || importBusy} onClick={() => { setImportOpen(false); setTemplateImportOpen(true); }}>Импортировать базовые поля шаблона</Button>}
    {report && ((report.sections.find(section => section.key === 'items')?.objects.length ?? 0) > 0 || (report.sections.find(section => section.key === 'skills')?.objects.length ?? 0) > 0) && <Button type="button" disabled={!canAnalyze || importBusy} onClick={() => { setImportOpen(false); setTemplateImportOpen(false); setCatalogImportOpen(true); }}>Импортировать определения предметов и навыков</Button>}
    {lastImport && !importOpen && <Panel title="Последний импорт"><HeroImportSummary plan={lastImport.plan} run={lastImport.run} campaignId={campaignId} /></Panel>}
    {importOpen && report && canAnalyze && <HeroImportWizard
      sources={report.sections.find(section => section.key === 'characters')?.objects ?? []}
      characters={report.sections.find(section => section.key === 'characters')?.objects ?? []}
      items={report.sections.find(section => section.key === 'items')?.objects ?? []}
      skills={report.sections.find(section => section.key === 'skills')?.objects ?? []}
      characterItems={report.sections.find(section => section.key === 'characterItems')?.objects ?? []}
      characterSkills={report.sections.find(section => section.key === 'characterSkills')?.objects ?? []}
      campaignId={campaignId} onClose={() => setImportOpen(false)} onResult={(plan, run) => setLastImport({ plan, run })}
    />}
    {templateImportOpen && report && canAnalyze && <LegacyTemplateFieldImportWizard sources={report.sections.find(section => section.key === 'charlists')?.objects ?? []} campaignId={campaignId} onClose={() => setTemplateImportOpen(false)} />}
    {catalogImportOpen && report && canAnalyze && <LegacyCatalogImportWizard items={report.sections.find(section => section.key === 'items')?.objects ?? []} skills={report.sections.find(section => section.key === 'skills')?.objects ?? []} skillAttributes={report.sections.find(section => section.key === 'skillAttributes')?.objects ?? []} campaignId={campaignId} onClose={() => setCatalogImportOpen(false)} />}
  </section>;
};

const LegacyExportDiscovery: React.FC = () => {
  const { groupId = '' } = useParams();
  const { sessionKey } = useWorkspace();
  const { mode, permissions, permissionsLoading } = useCampaignWorkspace();
  const canAnalyze = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  return <ScopedLegacyExportDiscovery key={`${sessionKey}:${groupId}`} canAnalyze={canAnalyze} campaignId={Number(groupId)} />;
};

export default LegacyExportDiscovery;
