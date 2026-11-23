import React, { useEffect, useId, useRef, useState } from 'react';
import { Checkbox, Field, FieldSet, Input, Panel, Select, Textarea } from '@tdn/shared';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogKind, QuantityUnit } from './catalogTypes';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import type { CatalogAttributeDiagnostic } from './CatalogAttributeValuesEditor';
import styles from './CatalogDefinitionFields.module.css';

export type CatalogDefinitionDraft = {
  name: string;
  kind: CatalogKind;
  isHidden: boolean;
  quantityUnit: QuantityUnit | null;
  allowNegative: boolean;
  description: string;
  attributes: CatalogAttributeOccurrence[];
};

export type CatalogDefinitionFieldsProps = {
  draft: CatalogDefinitionDraft;
  onChange: (draft: CatalogDefinitionDraft) => void;
  definitions: CatalogAttributeDefinition[];
  canPublish: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  diagnostics?: CatalogAttributeDiagnostic[];
  onValidityChange?: (invalid: boolean) => void;
};

type SharedFieldsProps = Pick<CatalogDefinitionFieldsProps, 'draft' | 'onChange' | 'readOnly' | 'disabled'> & { autoFocusName?: boolean };

export function createCatalogDefinitionDraft(kind: CatalogKind = 'Item'): CatalogDefinitionDraft {
  return { name: '', kind, isHidden: false, quantityUnit: kind === 'Item' ? 'Whole' : null, allowNegative: false, description: '', attributes: [] };
}

export const CatalogDefinitionBasics: React.FC<SharedFieldsProps & { onValidityChange?: (invalid: boolean) => void }> = ({ draft, onChange, readOnly = false, disabled = false, autoFocusName = false, onValidityChange }) => {
  const idPrefix = useId();
  const invalidName = !draft.name.trim();
  const callback = useRef(onValidityChange);
  callback.current = onValidityChange;
  useEffect(() => callback.current?.(!readOnly && invalidName), [invalidName, readOnly]);
  const update = (patch: Partial<CatalogDefinitionDraft>) => onChange({ ...draft, ...patch });
  return <div className={styles.basics}>
    <Field label="Название" htmlFor={`${idPrefix}-name`} error={!readOnly && invalidName ? 'Введите название.' : undefined}>
      {readOnly ? <p>{draft.name}</p> : <Input id={`${idPrefix}-name`} value={draft.name} disabled={disabled} autoFocus={autoFocusName} aria-invalid={invalidName || undefined} aria-describedby={invalidName ? `${idPrefix}-name-error` : undefined} onChange={event => update({ name: event.target.value })} />}
    </Field>
    <Field label="Описание" htmlFor={`${idPrefix}-description`}>
      {readOnly ? <p className={styles.description}>{draft.description || 'Описание отсутствует.'}</p> : <Textarea id={`${idPrefix}-description`} value={draft.description} disabled={disabled} onChange={event => update({ description: event.target.value })} />}
    </Field>
  </div>;
};

export const CatalogDefinitionSettings: React.FC<SharedFieldsProps & { canPublish: boolean }> = ({ draft, onChange, canPublish, readOnly = false, disabled = false }) => {
  const id = useId();
  const update = (patch: Partial<CatalogDefinitionDraft>) => onChange({ ...draft, ...patch });
  return <div className={styles.settings}>
    {canPublish && <label><Checkbox checked={draft.isHidden} disabled={disabled || readOnly} onChange={event => update({ isHidden: event.target.checked })} />Скрыть из общего каталога</label>}
    {draft.kind === 'Item' && <>
      <Field label="Единица количества" htmlFor={`${id}-quantity-unit`}>
        {readOnly ? <p>{draft.quantityUnit === 'Whole' ? 'Целое' : draft.quantityUnit === 'Fractional' ? 'Дробное' : 'Единичное'}</p> : <Select id={`${id}-quantity-unit`} value={draft.quantityUnit ?? 'Whole'} disabled={disabled} onChange={event => update({ quantityUnit: event.target.value as QuantityUnit })}><option value="Whole">Целое</option><option value="Fractional">Дробное</option><option value="Single">Единичное</option></Select>}
      </Field>
      <label><Checkbox checked={draft.allowNegative} disabled={disabled || readOnly} onChange={event => update({ allowNegative: event.target.checked })} />Разрешить отрицательное количество</label>
    </>}
  </div>;
};

export const CatalogDefinitionFields: React.FC<CatalogDefinitionFieldsProps & { autoFocusName?: boolean }> = ({ draft, onChange, definitions, canPublish, readOnly = false, disabled = false, diagnostics = [], onValidityChange, autoFocusName = false }) => {
  const [invalidAttributes, setInvalidAttributes] = useState(false);
  const invalidName = !draft.name.trim();
  const invalid = !readOnly && (invalidName || invalidAttributes);
  const callback = useRef(onValidityChange);
  callback.current = onValidityChange;
  useEffect(() => callback.current?.(invalid), [invalid]);
  const update = (patch: Partial<CatalogDefinitionDraft>) => onChange({ ...draft, ...patch });
  const publish = <CatalogDefinitionSettings draft={draft} onChange={onChange} canPublish={canPublish} readOnly={readOnly} disabled={disabled} />;
  return <div className={styles.editor}>
    <div className={styles.topGrid}>
      <Panel title="Основное" density="compact"><CatalogDefinitionBasics draft={draft} onChange={onChange} readOnly={readOnly} disabled={disabled} autoFocusName={autoFocusName} /></Panel>
      <Panel title="Настройки" density="compact">{publish}</Panel>
    </div>
    <FieldSet className={styles.attributes} legend="Характеристики">
      <CatalogAttributeValuesEditor definitions={definitions} values={draft.attributes} onChange={attributes => update({ attributes })} onValidityChange={setInvalidAttributes} disabled={disabled} readOnly={readOnly} diagnostics={diagnostics} />
    </FieldSet>
    {invalid && <p role="alert">Проверьте название и значения атрибутов.</p>}
  </div>;
};

export default CatalogDefinitionFields;
