import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Field, ModalPortal, Select } from '@tdn/shared';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';
import { catalogAttributeField, catalogAttributeIssue, catalogValueLabel, createCatalogOccurrence, defaultTypedValue } from './catalogModel';
import { catalogAttributeTags } from './catalogAttributeTags';
import { stringifyJson } from './json';
import { useDirtyDraft } from './Workspace';
import { ValueInput } from './ValueInput';
import styles from './CharacterCatalogAttributes.module.css';

export type CharacterCatalogAttributesProps = {
  definitions: CatalogAttributeDefinition[];
  sourceValues: CatalogAttributeOccurrence[];
  values: CatalogAttributeOccurrence[];
  savedValues?: CatalogAttributeOccurrence[];
  effectiveValues?: CatalogAttributeOccurrence[];
  lockedOccurrenceIds?: string[];
  readOnly?: boolean;
  disabled?: boolean;
  onChange: (values: CatalogAttributeOccurrence[]) => void;
  onValidityChange?: (invalid: boolean) => void;
};

type ChoiceDraft = {
  row: CatalogAttributeOccurrence;
  source?: CatalogAttributeOccurrence;
  schema: { typeKey: string; options: CatalogAttributeDefinition['options'] };
  value: CatalogAttributeOccurrence['value'];
  error?: string;
};

function formatOccurrence(definitions: CatalogAttributeDefinition[], occurrence: CatalogAttributeOccurrence): string {
  return catalogAttributeTags(definitions, [occurrence])[0]?.values.join('; ') ?? '';
}

export const CharacterCatalogAttributes: React.FC<CharacterCatalogAttributesProps> = ({
  definitions,
  sourceValues,
  values,
  savedValues,
  effectiveValues,
  lockedOccurrenceIds = [],
  readOnly = false,
  disabled = false,
  onChange,
  onValidityChange,
}) => {
  const idPrefix = useId();
  const baselineRef = useRef(savedValues ?? values);
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});
  const [newAttributeId, setNewAttributeId] = useState('');
  const [choiceDraft, setChoiceDraft] = useState<ChoiceDraft>();
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;

  const definitionById = useMemo(() => new Map(definitions.map(definition => [definition.id, definition])), [definitions]);
  const sourceById = useMemo(() => new Map(sourceValues.map(occurrence => [occurrence.id, occurrence])), [sourceValues]);
  const baselineValues = savedValues ?? baselineRef.current;
  const savedById = useMemo(() => new Map(baselineValues.map(occurrence => [occurrence.id, occurrence])), [baselineValues]);
  const valuesById = useMemo(() => new Map(values.map(occurrence => [occurrence.id, occurrence])), [values]);
  const effectiveById = useMemo(() => effectiveValues ? new Map(effectiveValues.map(occurrence => [occurrence.id, occurrence])) : undefined, [effectiveValues]);
  const lockedIds = useMemo(() => new Set(lockedOccurrenceIds), [lockedOccurrenceIds]);
  const activeIds = useMemo(() => new Set(values.map(occurrence => occurrence.id)), [values]);
  const orderedIds = useMemo(() => [...new Set([...sourceValues, ...baselineValues, ...(effectiveValues ?? []), ...values].map(occurrence => occurrence.id))], [sourceValues, baselineValues, effectiveValues, values]);
  const supportedDefinitions = useMemo(() => definitions.filter(definition => catalogAttributeField(definition)
    && defaultTypedValue(definition.typeKey, definition.options) !== undefined), [definitions]);

  const fieldFor = (occurrence: CatalogAttributeOccurrence) => catalogAttributeField(definitionById.get(occurrence.attributeId));
  const bindingMatches = (left: CatalogAttributeOccurrence, right: CatalogAttributeOccurrence) => left.attributeId === right.attributeId && left.editLevel === right.editLevel;
  const sourceBindingValid = (occurrence: CatalogAttributeOccurrence) => {
    const source = sourceById.get(occurrence.id);
    return !source || (source.editLevel === 'Character' && source.attributeId === occurrence.attributeId);
  };
  const editableLocal = (occurrence: CatalogAttributeOccurrence) => !readOnly && !disabled
    && occurrence.editLevel === 'Character' && !lockedIds.has(occurrence.id)
    && sourceBindingValid(occurrence) && Boolean(fieldFor(occurrence));

  const nonEffectiveIds = useMemo(() => {
    if (!effectiveById) return new Set<string>();
    return new Set(baselineValues.filter(local => {
      const effective = effectiveById.get(local.id);
      return !effective || !bindingMatches(local, effective);
    }).map(local => local.id));
  }, [effectiveById, baselineValues]);
  const changedAttributes = values.some(occurrence => {
    const saved = savedById.get(occurrence.id);
    return !saved || stringifyJson(saved) !== stringifyJson(occurrence);
  }) || baselineValues.some(saved => !valuesById.has(saved.id));
  const changedInvalid = values.some(occurrence => {
    const saved = savedById.get(occurrence.id);
    if (saved && stringifyJson(saved) === stringifyJson(occurrence)) return false;
    return !sourceBindingValid(occurrence) || Boolean(catalogAttributeIssue(definitionById.get(occurrence.attributeId), occurrence));
  });
  const hasInvalidInput = !readOnly && (changedInvalid
    || Object.entries(inputErrors).some(([id, invalid]) => invalid && activeIds.has(id) && valuesById.has(id) && editableLocal(valuesById.get(id)!))
    || Boolean(effectiveById && changedAttributes && [...nonEffectiveIds].some(id => valuesById.has(id))));
  const choiceDirty = Boolean(choiceDraft && stringifyJson(choiceDraft.value) !== stringifyJson(choiceDraft.row.value));
  useDirtyDraft(`character-catalog-attributes-choice-${idPrefix}`, choiceDirty);

  useEffect(() => {
    const prune = (current: Record<string, boolean>) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    };
    setInputErrors(prune);
  }, [activeIds]);

  useEffect(() => {
    validityCallback.current?.(hasInvalidInput);
  }, [hasInvalidInput]);

  useEffect(() => {
    if (!newAttributeId && supportedDefinitions.length) setNewAttributeId(supportedDefinitions[0].id);
  }, [newAttributeId, supportedDefinitions]);

  const updateOccurrence = (id: string, occurrence: CatalogAttributeOccurrence) => {
    onChange(values.map(item => item.id === id ? occurrence : item));
  };

  const removeLocal = (id: string) => {
    onChange(values.filter(item => item.id !== id));
    setInputErrors(current => { const next = { ...current }; delete next[id]; return next; });
  };

  const restoreSaved = (occurrence: CatalogAttributeOccurrence) => {
    if (valuesById.has(occurrence.id)) return;
    const savedIndex = baselineValues.findIndex(item => item.id === occurrence.id);
    let insertionIndex = -1;
    for (let index = savedIndex + 1; index < baselineValues.length; index += 1) {
      const nextIndex = values.findIndex(item => item.id === baselineValues[index].id);
      if (nextIndex >= 0) { insertionIndex = nextIndex; break; }
    }
    if (insertionIndex < 0) {
      for (let index = savedIndex - 1; index >= 0; index -= 1) {
        const previousIndex = values.findIndex(item => item.id === baselineValues[index].id);
        if (previousIndex >= 0) { insertionIndex = previousIndex + 1; break; }
      }
    }
    if (insertionIndex < 0) {
      const firstNewIndex = values.findIndex(item => !savedById.has(item.id));
      insertionIndex = firstNewIndex >= 0 ? firstNewIndex : values.length;
    }
    const next = [...values];
    next.splice(insertionIndex, 0, occurrence);
    onChange(next);
    setInputErrors(current => ({ ...current, [occurrence.id]: false }));
  };

  const addOccurrence = () => {
    const definition = supportedDefinitions.find(item => item.id === newAttributeId);
    if (!definition) return;
    const occurrence = createCatalogOccurrence(definition, 'Character');
    if (!occurrence) return;
    onChange([...values, occurrence]);
  };

  const renderChoiceModal = () => {
    if (!choiceDraft) return null;
    const currentRow = valuesById.get(choiceDraft.row.id);
    const currentSource = sourceById.get(choiceDraft.row.id);
    const currentDefinition = currentRow ? definitionById.get(currentRow.attributeId) : undefined;
    const currentField = catalogAttributeField(currentDefinition);
    const sameBinding = Boolean(currentRow && bindingMatches(currentRow, choiceDraft.row));
    const sourceBindingMatches = Boolean(Boolean(currentSource) === Boolean(choiceDraft.source)
      && (!currentSource || !choiceDraft.source || bindingMatches(currentSource, choiceDraft.source)));
    const schemaCurrent = Boolean(currentDefinition && currentDefinition.typeKey === choiceDraft.schema.typeKey
      && stringifyJson(currentDefinition.options) === stringifyJson(choiceDraft.schema.options) && currentDefinition.typeKey === 'multiChoice');
    const canEditChoice = Boolean(currentRow && !readOnly && !disabled && sameBinding && sourceBindingMatches && schemaCurrent
      && editableLocal(currentRow) && !nonEffectiveIds.has(currentRow.id));
    const valueIssue = currentRow && currentDefinition ? catalogAttributeIssue(currentDefinition, { ...currentRow, value: choiceDraft.value }) : 'Характеристика удалена или недоступна.';
    const canApply = canEditChoice && !valueIssue;
    return <ModalPortal isOpen title={`Значения: ${currentDefinition?.title ?? 'характеристика'}`} onClose={() => setChoiceDraft(undefined)}
      footer={<ActionRow justify="end"><Button type="button" variant="secondary" onClick={() => setChoiceDraft(undefined)}>Отмена</Button><Button type="button" disabled={!canApply || Boolean(choiceDraft.error)} onClick={() => {
        if (!canApply || !currentRow) return;
        updateOccurrence(currentRow.id, { ...currentRow, value: choiceDraft.value });
        setChoiceDraft(undefined);
      }}>Применить</Button></ActionRow>}>
      {!canEditChoice && <p role="status">Характеристика или право редактирования изменились. Черновик выбора сохранён.</p>}
      {currentField && canEditChoice
        ? <ValueInput field={currentField} value={choiceDraft.value} label={`Значение: ${currentDefinition?.title ?? 'характеристика'}`} onChange={value => setChoiceDraft(current => current ? { ...current, value } : current)} onValidityChange={error => setChoiceDraft(current => current ? { ...current, error } : current)} />
        : <p>{currentDefinition?.typeKey === 'multiChoice' ? catalogValueLabel(choiceDraft.value, currentDefinition) : 'Выбор недоступен'}</p>}
      {valueIssue && <p role="alert">{valueIssue}</p>}
      {choiceDraft.error && <p role="alert">{choiceDraft.error}</p>}
    </ModalPortal>;
  };

  return <div className={styles.root}>
    {orderedIds.length === 0 && <p>Характеристик пока нет.</p>}
    {orderedIds.map(id => {
      const source = sourceById.get(id);
      const saved = savedById.get(id);
      const local = valuesById.get(id);
      const effective = effectiveById?.get(id);
      const localDefinition = local ? definitionById.get(local.attributeId) : undefined;
      const savedNotApplied = Boolean(effectiveById && saved && nonEffectiveIds.has(id));
      const relationMismatch = Boolean(local && saved && savedNotApplied);
      const localBindingMismatch = Boolean(local && !sourceBindingValid(local));
      const localApplicable = Boolean(local && !relationMismatch && !localBindingMismatch);
      const savedPendingRemoval = Boolean(saved && !local);
      const primary = readOnly
        ? effectiveById ? effective : source
        : savedPendingRemoval
          ? saved
          : localApplicable
            ? local
            : effective ?? source ?? saved ?? local;
      const rowDefinitionOccurrence = primary ?? local ?? saved ?? source;
      if (!rowDefinitionOccurrence) return null;
      const definition = primary ? definitionById.get(primary.attributeId) : undefined;
      const rowDefinition = definitionById.get(rowDefinitionOccurrence.attributeId);
      const title = rowDefinition?.title ?? 'Характеристика удалена';
      const locked = lockedIds.has(id);
      const localIssue = local ? catalogAttributeIssue(definitionById.get(local.attributeId), local) : undefined;
      const sourceIssue = source ? catalogAttributeIssue(definitionById.get(source.attributeId), source) : undefined;
      const localChanged = Boolean(local && (!saved || stringifyJson(local) !== stringifyJson(saved)));
      const changeLabel = localChanged ? saved ? 'Изменено' : 'Добавлено' : undefined;
      const localEditable = Boolean(local && localApplicable && editableLocal(local) && !localIssue);
      const sourceCanCopy = Boolean(source && !local && !saved && !readOnly && !disabled && source.editLevel === 'Character' && !lockedIds.has(id) && catalogAttributeField(definitionById.get(source.attributeId)));
      const canReplaceLocal = Boolean(local && localIssue && localDefinition && !readOnly && !disabled && local.editLevel === 'Character' && !locked);
      const canRebind = Boolean(local && !source && !readOnly && !disabled && local.editLevel === 'Character' && !locked);
      const multiChoice = Boolean(local && localEditable && localDefinition?.typeKey === 'multiChoice');
      const valueLabel = primary ? formatOccurrence(definitions, primary) : '';
      const localDetails = local ? formatOccurrence(definitions, local) : saved ? formatOccurrence(definitions, saved) : '';
      const replaceLocal = () => {
        if (!local || !localDefinition || !canReplaceLocal) return;
        const value = defaultTypedValue(localDefinition.typeKey, localDefinition.options);
        if (value === undefined) return;
        updateOccurrence(id, { id: local.id, attributeId: local.attributeId, editLevel: local.editLevel, value });
        setInputErrors(current => ({ ...current, [id]: false }));
      };
      const issueMessage = localIssue || sourceIssue;
      return <div className={styles.row} key={id}>
        <div className={styles.name}>
          {canRebind && localDefinition && <Select aria-label={`Характеристика: ${title}`} value={local!.attributeId} disabled={disabled} onChange={event => {
            const nextDefinition = supportedDefinitions.find(item => item.id === event.target.value);
            const next = nextDefinition && createCatalogOccurrence(nextDefinition, 'Character');
            if (next) updateOccurrence(id, { ...next, id });
          }}><option value={local!.attributeId}>{title}</option>{supportedDefinitions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>}
          {!canRebind && <span>{title}</span>}
        </div>
        <div className={styles.value}>
          {multiChoice && local
            ? <><span>{valueLabel || 'Не выбрано'}</span><Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => setChoiceDraft({ row: local, source, schema: { typeKey: localDefinition!.typeKey, options: localDefinition!.options }, value: local.value })}>Выбрать значения: {title}</Button></>
            : localEditable && local && localDefinition
              ? <ValueInput field={catalogAttributeField(localDefinition)!} value={local.value} label={`Значение: ${title}`} compact inline disabled={disabled} onChange={value => updateOccurrence(id, { ...local, value })} onValidityChange={error => setInputErrors(current => current[id] === Boolean(error) ? current : { ...current, [id]: Boolean(error)})} />
              : <span className={styles.valueText}>{valueLabel || (readOnly && effectiveById && !effective ? 'Не применяется' : 'Не задано')}</span>}
          {issueMessage && <small className={styles.note}>{definition ? 'Значение не соответствует текущей характеристике.' : 'Характеристика удалена или недоступна.'}</small>}
          {savedPendingRemoval && <small className={styles.note}>{source ? 'Сброс ожидает сохранения; значение из каталога пока не подтверждено.' : 'Характеристика будет убрана после сохранения.'}</small>}
          {changeLabel && <small className={styles.note}>{changeLabel}</small>}
          {(savedNotApplied || localBindingMismatch) && <details className={styles.unapplied}><summary>Собственное значение не применяется</summary><span>{localDetails || 'Не задано'}</span></details>}
          {canReplaceLocal && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={replaceLocal}>Заменить некорректное значение</Button>}
          {source && sourceIssue && !local && <small className={styles.note}>Значение не соответствует текущей характеристике.</small>}
        </div>
        <div className={styles.actions}>
          {sourceCanCopy && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => {
            if (!source || valuesById.has(id)) return;
            onChange([...values, source]);
          }}>Изменить: {title}</Button>}
          {savedPendingRemoval && !readOnly && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => restoreSaved(saved!)}>Отменить {source ? 'сброс' : 'удаление'}</Button>}
          {local && !savedPendingRemoval && !readOnly && <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => removeLocal(id)}>{source ? `Сбросить к каталогу: ${title}` : `Убрать характеристику: ${title}`}</Button>}
        </div>
      </div>;
    })}
    {!readOnly && <ActionRow className={styles.addRow}>
      <Field label="Новая характеристика" htmlFor={`${idPrefix}-new-attribute`}>
        <Select id={`${idPrefix}-new-attribute`} value={newAttributeId} disabled={disabled || supportedDefinitions.length === 0} onChange={event => setNewAttributeId(event.target.value)}>
          <option value="">Выберите характеристику</option>{supportedDefinitions.map(definition => <option key={definition.id} value={definition.id}>{definition.title}</option>)}
        </Select>
      </Field>
      <Button type="button" size="small" disabled={disabled || !supportedDefinitions.some(definition => definition.id === newAttributeId)} onClick={addOccurrence}>Добавить характеристику</Button>
    </ActionRow>}
    {hasInvalidInput && <p role="alert">Исправьте некорректные значения перед сохранением.</p>}
    {renderChoiceModal()}
  </div>;
};

export default CharacterCatalogAttributes;
