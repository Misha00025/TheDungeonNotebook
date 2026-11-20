import React, { useLayoutEffect, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, Field, FileInput, Panel } from '@tdn/shared';
import { useParams } from 'react-router-dom';
import { displayValue } from './json';
import type { JsonValue } from './types';
import { discoverLegacyExport } from './legacyDiscovery';
import type { LegacyDiscovery, LegacyField, LegacyObject, LegacySection } from './legacyDiscovery';
import { useWorkspace } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import styles from './Workspace.module.css';

const readValue = (data: Record<string, JsonValue>, key: string) => Object.prototype.hasOwnProperty.call(data, key) ? formatValue(data[key]) : 'Не задано';
const formatValue = (value: JsonValue) => value === '' ? 'Пустая строка' : value === null ? 'null' : displayValue(value);
const unsupportedSections = new Set(['items', 'skills', 'characterItems', 'characterSkills', 'skillAttributes']);

const FieldTable: React.FC<{ fields: LegacyField[] }> = ({ fields }) => <DataTable aria-label="Исходные поля" minWidth="60rem">
  <thead><tr><th>Название</th><th>Ключ</th><th>Значение</th><th>Формула</th><th>Формула модификатора</th><th>Максимум</th><th>Описание</th></tr></thead>
  <tbody>{fields.map((field, index) => <tr key={`${field.key}:${index}`}>
    <th scope="row">{field.name}</th><td>{field.key}</td>
    <td>{readValue(field.data, 'value')}</td><td>{readValue(field.data, 'formula')}</td>
    <td>{readValue(field.data, 'modifierFormula')}</td><td>{readValue(field.data, 'maxValue')}</td>
    <td>{readValue(field.data, 'description')}</td>
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
  {section.present && section.objects.length > 0 && unsupportedSections.has(section.key) && <p>Обнаружено, но запись этих данных текущим API не поддерживается.</p>}
  {section.objects.map((object, objectIndex) => <ObjectDetails key={`${sectionIndex}:${objectIndex}`} object={object} sectionKey={section.key} />)}
</details>;

const Report: React.FC<{ report: LegacyDiscovery }> = ({ report }) => <>
  <Panel>
    <p>Версия: {report.version}</p>
    {report.exportedAt !== undefined && <p>Дата экспорта: {report.exportedAt}</p>}
    <p>Показано только содержимое файла. Ничего не импортировано.</p>
  </Panel>
  <Panel>
    {report.sections.map((section, index) => <SectionDetails key={`${section.key}:${index}`} section={section} sectionIndex={index} />)}
  </Panel>
  {report.unknownSections.length > 0 && <Panel title="Неизвестные разделы"><ul>{report.unknownSections.map((name, index) => <li key={`${name}:${index}`}>{name}</li>)}</ul></Panel>}
  {report.diagnostics.length > 0 && <Panel title="Замечания к файлу"><ul>{report.diagnostics.map((diagnostic, index) => <li key={index}>{diagnostic}</li>)}</ul></Panel>}
</>;

const ScopedLegacyExportDiscovery: React.FC<{ canAnalyze: boolean }> = ({ canAnalyze }) => {
  const [report, setReport] = useState<LegacyDiscovery>();
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
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
    if (input.current) input.current.value = '';
  }, [canAnalyze]);

  const clear = () => {
    sequence.current += 1;
    setReport(undefined);
    setError(undefined);
    setFileName('');
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const selectFile = async (file?: File) => {
    if (!canAnalyze) return;
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
    <p>Файл анализируется только в браузере. Данные кампании не изменяются.</p>
    <Field label="JSON старого экспорта" htmlFor="legacy-export-file">
      <FileInput ref={input} id="legacy-export-file" accept=".json,application/json" disabled={!canAnalyze} onChange={event => { void selectFile(event.currentTarget.files?.[0]); }} />
    </Field>
    <ActionRow>
      <Button type="button" variant="secondary" disabled={!canAnalyze} onClick={clear}>Очистить</Button>
    </ActionRow>
    {fileName && <p>Файл: {fileName}</p>}
    {busy && <p role="status">Анализ файла…</p>}
    {error && <p role="alert">{error}</p>}
    {report && <Report report={report} />}
  </section>;
};

const LegacyExportDiscovery: React.FC = () => {
  const { groupId = '' } = useParams();
  const { sessionKey } = useWorkspace();
  const { mode, permissions, permissionsLoading } = useCampaignWorkspace();
  const canAnalyze = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  return <ScopedLegacyExportDiscovery key={`${sessionKey}:${groupId}`} canAnalyze={canAnalyze} />;
};

export default LegacyExportDiscovery;
