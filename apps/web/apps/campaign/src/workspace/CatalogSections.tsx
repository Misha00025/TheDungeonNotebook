import React from 'react';
import { Button, List, StatePanel } from '@tdn/shared';
import { ApiError } from './Feedback';
import type { CatalogBrowseSection } from './catalogBrowseModel';
import type { CatalogMetadata } from './catalogTypes';
import styles from './CatalogSections.module.css';

export type CatalogSectionsProps = {
  sections: CatalogBrowseSection[];
  openKeys: Set<string>;
  onToggle: (key: string, open: boolean) => void;
  onOpenEntry: (metadata: CatalogMetadata) => void;
  onRetryMembership: (groupId: string) => void;
};

const EntryRow: React.FC<{ entry: CatalogMetadata; onOpen: (entry: CatalogMetadata) => void }> = ({ entry, onOpen }) => (
  <Button className={styles.entry} size="small" variant="ghost" type="button" onClick={() => onOpen(entry)}>
    <span>{entry.name}</span><small>{entry.kind === 'Item' ? 'Предмет' : 'Навык'}</small>
  </Button>
);

const diagnosticLabels: Record<string, string> = {
  invalid_condition: 'Условие группы некорректно; автоматический отбор отключён.',
  unknown_attribute: 'Условие ссылается на отсутствующий атрибут.',
  incompatible_attribute_type: 'Условие использует устаревший тип атрибута.',
  invalid_attribute_value: 'Значение условия не соответствует схеме.',
};

const Section: React.FC<{ section: CatalogBrowseSection; props: CatalogSectionsProps }> = ({ section, props }) => {
  const isOpen = props.openKeys.has(section.key);
  return <details className={styles.section} open={isOpen} onToggle={event => {
    const nextOpen = event.currentTarget.open;
    if (nextOpen !== isOpen) props.onToggle(section.key, nextOpen);
  }}>
    <summary className={styles.summary}><span className={styles.chevron} aria-hidden="true" />{section.title}</summary>
    {isOpen && <div className={styles.body}>
      {section.state === 'loading' && <StatePanel kind="loading">Загрузка состава раздела…</StatePanel>}
      {section.state === 'error' && <><ApiError error={section.error} /><Button size="small" variant="ghost" type="button" onClick={() => props.onRetryMembership(section.key.slice('group:'.length))}>Повторить загрузку раздела</Button></>}
      {section.state === 'ready' && section.diagnostics.map((diagnostic, index) => <p className={styles.diagnostic} role="status" key={`${diagnostic.groupId}-${diagnostic.entryId ?? 'group'}-${diagnostic.code}-${index}`}>{diagnosticLabels[diagnostic.code] ?? 'Сервер обнаружил проблему при вычислении состава группы.'}</p>)}
      {section.state === 'ready' && section.ownEntries.length > 0 && <List className={styles.entries} layout="vertical" gap="small" aria-label={`Записи: ${section.title}`}>
        {section.ownEntries.map(entry => <EntryRow key={entry.id} entry={entry} onOpen={props.onOpenEntry} />)}
      </List>}
      {section.children.map(child => <Section key={child.key} section={child} props={props} />)}
    </div>}
  </details>;
};

const CatalogSections: React.FC<CatalogSectionsProps> = props => <div className={styles.sections}>
  {props.sections.map(section => <Section key={section.key} section={section} props={props} />)}
</div>;

export default CatalogSections;
