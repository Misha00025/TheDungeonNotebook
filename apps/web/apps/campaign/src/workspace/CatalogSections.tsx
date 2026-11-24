import React from 'react';
import { Button, StatePanel } from '@tdn/shared';
import { ApiError } from './Feedback';
import { useResource } from './hooks';
import type { CatalogBrowseSection } from './catalogBrowseModel';
import type { CatalogAttributeDefinition, CatalogContentEnvelope, CatalogMetadata } from './catalogTypes';
import { CatalogEntryTable, CatalogEntryTableRow } from './CatalogEntryTable';
import styles from './CatalogSections.module.css';

export type CatalogSectionsProps = {
  sections: CatalogBrowseSection[];
  openKeys: Set<string>;
  onToggle: (key: string, open: boolean) => void;
  onOpenEntry: (metadata: CatalogMetadata) => void;
  onSelectEntry?: (metadata: CatalogMetadata) => void;
  selectionDisabled?: boolean;
  onRetryMembership: (groupId: string) => void;
  definitions?: CatalogAttributeDefinition[];
  loadContent: (id: string) => Promise<CatalogContentEnvelope>;
  previewScope: string;
  previewVersions: Record<string, number>;
  attributeSchemaLoading: boolean;
};

const EntryRow: React.FC<{ entry: CatalogMetadata; props: CatalogSectionsProps }> = ({ entry, props }) => {
  const key = `${props.previewScope}:${entry.id}:${props.previewVersions[entry.id] ?? 0}`;
  const content = useResource(key, () => props.loadContent(entry.id), Boolean(props.definitions));
  return <CatalogEntryTableRow name={entry.name} onOpen={() => props.onOpenEntry(entry)} definitions={props.definitions} values={content.data?.data.attributes} attributesLoading={props.attributeSchemaLoading || Boolean(props.definitions && content.loading)} attributesError={content.error} onRetryAttributes={content.reload} selection={props.onSelectEntry && <Button size="small" variant="secondary" type="button" aria-label={`Выбрать ${entry.name}`} disabled={props.selectionDisabled} onClick={() => props.onSelectEntry?.(entry)}>Выбрать</Button>} />;
};

const diagnosticLabels: Record<string, string> = {
  invalid_condition: 'Условие группы некорректно; автоматический отбор отключён.',
  unknown_attribute: 'Условие ссылается на отсутствующий атрибут.',
  incompatible_attribute_type: 'Условие использует устаревший тип атрибута.',
  invalid_attribute_value: 'Значение условия не соответствует схеме.',
};

const Section: React.FC<{ section: CatalogBrowseSection; props: CatalogSectionsProps; depth: number }> = ({ section, props, depth }) => {
  const isOpen = props.openKeys.has(section.key);
  const Heading = depth === 1 ? 'h1' : depth === 2 ? 'h2' : 'h3';
  return <details className={styles.section} open={isOpen} onToggle={event => {
    const nextOpen = event.currentTarget.open;
    if (nextOpen !== isOpen) props.onToggle(section.key, nextOpen);
  }}>
    <summary className={styles.summary}><Heading className={styles.groupHeading}><span className={styles.chevron} aria-hidden="true" />{section.title}</Heading></summary>
    {isOpen && <div className={styles.body}>
      {section.state === 'loading' && <StatePanel kind="loading">Загрузка состава раздела…</StatePanel>}
      {section.state === 'error' && <><ApiError error={section.error} /><Button size="small" variant="ghost" type="button" onClick={() => props.onRetryMembership(section.key.slice('group:'.length))}>Повторить загрузку раздела</Button></>}
      {section.state === 'ready' && section.diagnostics.map((diagnostic, index) => <p className={styles.diagnostic} role="status" key={`${diagnostic.groupId}-${diagnostic.entryId ?? 'group'}-${diagnostic.code}-${index}`}>{diagnosticLabels[diagnostic.code] ?? 'Сервер обнаружил проблему при вычислении состава группы.'}</p>)}
       {section.state === 'ready' && section.ownEntries.length > 0 && <CatalogEntryTable label={`Записи: ${section.title}`} showSelection={Boolean(props.onSelectEntry)}>
          {section.ownEntries.map(entry => <EntryRow key={entry.id} entry={entry} props={props} />)}
       </CatalogEntryTable>}
       {section.children.map(child => <Section key={child.key} section={child} props={props} depth={depth + 1} />)}
    </div>}
  </details>;
};

const CatalogSections: React.FC<CatalogSectionsProps> = props => <div className={styles.sections}>
  {props.sections.map(section => <Section key={section.key} section={section} props={props} depth={1} />)}
</div>;

export default CatalogSections;
