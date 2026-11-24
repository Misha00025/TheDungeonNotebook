import React, { useMemo, useState } from 'react';
import { Badge, Button, DisclosureListItem, IconButton, List, StatePanel } from '@tdn/shared';
import { CampaignApiError } from './api';
import { ApiError } from './Feedback';
import { useResource } from './hooks';
import { catalogAttributeTags } from './catalogAttributeTags';
import type { CatalogBrowseSection } from './catalogBrowseModel';
import type { CatalogAttributeDefinition, CatalogContentEnvelope, CatalogMetadata } from './catalogTypes';
import styles from './CatalogSections.module.css';

export type CatalogSectionsProps = {
  sections: CatalogBrowseSection[];
  openKeys: Set<string>;
  onToggle: (key: string, open: boolean) => void;
  onEditEntry?: (metadata: CatalogMetadata) => void;
  canEditEntry?: (metadata: CatalogMetadata) => boolean;
  onSelectEntry?: (metadata: CatalogMetadata) => void;
  selectionDisabled?: boolean;
  onRetryMembership: (groupId: string) => void;
  definitions?: CatalogAttributeDefinition[];
  loadContent: (id: string) => Promise<CatalogContentEnvelope>;
  previewScope: string;
  previewVersions: Record<string, number>;
  attributeSchemaLoading: boolean;
  attributeSchemaError?: unknown;
  onRetryAttributeSchema: () => void;
  showVisibility?: boolean;
};

type EntryRowProps = {
  entry: CatalogMetadata;
  sectionKey: string;
  props: CatalogSectionsProps;
  expanded: boolean;
  onExpandedChange: (key: string, expanded: boolean) => void;
};

const EntryRow: React.FC<EntryRowProps> = ({ entry, sectionKey, props, expanded, onExpandedChange }) => {
  const resourceKey = `${props.previewScope}:${entry.id}:${props.previewVersions[entry.id] ?? 0}`;
  const content = useResource(resourceKey, () => props.loadContent(entry.id));
  const contentUnavailable = content.error instanceof CampaignApiError
    && (content.error.status === 403 || content.error.status === 404);
  const visibleContent = contentUnavailable ? undefined : content.data;
  const occurrences = visibleContent?.data.attributes;
  const tags = useMemo(() => props.definitions && occurrences
    ? catalogAttributeTags(props.definitions, occurrences).map(tag => ({
      key: tag.attributeId,
      label: `${tag.title}: ${tag.values.join('; ')}`,
    }))
    : [], [occurrences, props.definitions]);
  const itemKey = `${sectionKey}:${entry.id}`;
  const summaryStatus = visibleContent
    ? undefined
    : content.error
      ? 'Описание недоступно.'
      : content.loading
        ? 'Загрузка описания…'
        : 'Описание недоступно.';
  const knownAttributeIds = new Set(tags.map(tag => tag.key));
  const attributesUnavailable = Boolean(occurrences?.some(occurrence => !knownAttributeIds.has(occurrence.attributeId)));
  const schemaUnavailable = !props.definitions && Boolean(occurrences?.length);
  const actions = <>
    {Boolean(content.error) && <IconButton
      icon="undo"
      size="small"
      variant="ghost"
      title={`Повторить загрузку описания ${entry.name}`}
      ariaLabel={`Повторить загрузку описания ${entry.name}`}
      onClick={content.reload}
    />}
    {props.onEditEntry && props.canEditEntry?.(entry) && <IconButton
      icon="edit"
      size="small"
      variant="ghost"
      title={`Редактировать ${entry.name}`}
      ariaLabel={`Редактировать ${entry.name}`}
      onClick={() => props.onEditEntry?.(entry)}
    />}
    {props.onSelectEntry && <IconButton
      icon="check"
      size="small"
      variant="ghost"
      title={`Выбрать ${entry.name}`}
      ariaLabel={`Выбрать ${entry.name}`}
      disabled={props.selectionDisabled}
      onClick={() => props.onSelectEntry?.(entry)}
    />}
  </>;

  return <DisclosureListItem
    role="listitem"
    title={entry.name}
    titleAside={props.showVisibility && entry.isHidden ? <Badge>Скрытая запись</Badge> : undefined}
    description={visibleContent?.data.description}
    tags={tags}
    expanded={expanded}
    onExpandedChange={value => onExpandedChange(itemKey, value)}
    actions={actions}
    summaryStatus={summaryStatus}
    aria-busy={content.loading || props.attributeSchemaLoading || undefined}
  >
    {content.loading && !visibleContent && <StatePanel kind="loading">Загрузка описания и характеристик…</StatePanel>}
    {Boolean(content.error) && <ApiError error={content.error} />}
    {schemaUnavailable && props.attributeSchemaLoading && <StatePanel kind="loading">Загрузка характеристик…</StatePanel>}
    {schemaUnavailable && Boolean(props.attributeSchemaError) && <>
      <ApiError error={props.attributeSchemaError} />
      <p role="status">Характеристики недоступны; описание записи сохранено.</p>
      <Button type="button" size="small" variant="secondary" onClick={props.onRetryAttributeSchema}>Повторить загрузку характеристик</Button>
    </>}
    {schemaUnavailable && !props.attributeSchemaLoading && !props.attributeSchemaError && <p role="status">Характеристики не загружены.</p>}
    {attributesUnavailable && !schemaUnavailable && <p role="status">Некоторые характеристики недоступны по текущей схеме.</p>}
  </DisclosureListItem>;
};

const diagnosticLabels: Record<string, string> = {
  invalid_condition: 'Условие группы некорректно; автоматический отбор отключён.',
  unknown_attribute: 'Условие ссылается на отсутствующий атрибут.',
  incompatible_attribute_type: 'Условие использует устаревший тип атрибута.',
  invalid_attribute_value: 'Значение условия не соответствует схеме.',
};

type SectionProps = {
  section: CatalogBrowseSection;
  props: CatalogSectionsProps;
  depth: number;
  openEntryKeys: Set<string>;
  onEntryExpandedChange: (key: string, expanded: boolean) => void;
};

const Section: React.FC<SectionProps> = ({ section, props, depth, openEntryKeys, onEntryExpandedChange }) => {
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
      {section.state === 'ready' && section.ownEntries.length > 0 && <List layout="vertical" gap="small" stretch role="list" aria-label={`Записи: ${section.title}`}>
        {section.ownEntries.map(entry => {
          const itemKey = `${section.key}:${entry.id}`;
          return <EntryRow
            key={itemKey}
            entry={entry}
            sectionKey={section.key}
            props={props}
            expanded={openEntryKeys.has(itemKey)}
            onExpandedChange={onEntryExpandedChange}
          />;
        })}
      </List>}
      {section.children.map(child => <Section
        key={child.key}
        section={child}
        props={props}
        depth={depth + 1}
        openEntryKeys={openEntryKeys}
        onEntryExpandedChange={onEntryExpandedChange}
      />)}
    </div>}
  </details>;
};

const CatalogSections: React.FC<CatalogSectionsProps> = props => {
  const [openEntryKeys, setOpenEntryKeys] = useState<Set<string>>(() => new Set());
  const onEntryExpandedChange = (key: string, expanded: boolean) => {
    setOpenEntryKeys(current => {
      const next = new Set(current);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return <div className={styles.sections}>
    {props.sections.map(section => <Section
      key={section.key}
      section={section}
      props={props}
      depth={1}
      openEntryKeys={openEntryKeys}
      onEntryExpandedChange={onEntryExpandedChange}
    />)}
  </div>;
};

export default CatalogSections;
