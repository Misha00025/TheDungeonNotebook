import React, { useEffect, useId, useRef, useState } from 'react';
import { Checkbox, Field, Input, Select, Textarea } from '@tdn/shared';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogKind, QuantityUnit } from './catalogTypes';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import type { CatalogAttributeDiagnostic } from './CatalogAttributeValuesEditor';

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
  creating: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  diagnostics?: CatalogAttributeDiagnostic[];
  onValidityChange?: (invalid: boolean) => void;
};

export function createCatalogDefinitionDraft(kind: CatalogKind = 'Item'): CatalogDefinitionDraft {
  return {
    name: '',
    kind,
    isHidden: false,
    quantityUnit: kind === 'Item' ? 'Whole' : null,
    allowNegative: false,
    description: '',
    attributes: [],
  };
}

export const CatalogDefinitionFields: React.FC<CatalogDefinitionFieldsProps> = ({
  draft,
  onChange,
  definitions,
  canPublish,
  creating,
  readOnly = false,
  disabled = false,
  diagnostics = [],
  onValidityChange,
}) => {
  const idPrefix = useId();
  const [invalidAttributes, setInvalidAttributes] = useState(false);
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  const invalidName = !draft.name.trim();
  const invalid = !readOnly && (invalidName || invalidAttributes);

  useEffect(() => {
    validityCallback.current?.(invalid);
  }, [invalid]);

  const update = (patch: Partial<CatalogDefinitionDraft>) => onChange({ ...draft, ...patch });
  const setKind = (kind: CatalogKind) => update({
    kind,
    ...(kind === 'Skill' ? { quantityUnit: null, allowNegative: false } : { quantityUnit: draft.quantityUnit ?? 'Whole' }),
  });

  return <div>
    <Field label="Название" htmlFor={`${idPrefix}-name`} error={!readOnly && invalidName ? 'Введите название.' : undefined}>
      {readOnly
        ? <p>{draft.name}</p>
        : <Input id={`${idPrefix}-name`} value={draft.name} disabled={disabled} aria-invalid={invalidName || undefined} aria-describedby={invalidName ? `${idPrefix}-name-error` : undefined} onChange={event => update({ name: event.target.value })} />}
    </Field>
    <Field label="Тип определения" htmlFor={`${idPrefix}-kind`}>
      {creating && !readOnly
        ? <Select id={`${idPrefix}-kind`} value={draft.kind} disabled={disabled} onChange={event => setKind(event.target.value as CatalogKind)}>
          <option value="Item">Предмет</option>
          <option value="Skill">Навык</option>
        </Select>
        : <p>{draft.kind === 'Item' ? 'Предмет' : 'Навык'}</p>}
    </Field>
    {canPublish && <label>
      <Checkbox checked={draft.isHidden} disabled={disabled || readOnly} onChange={event => update({ isHidden: event.target.checked })} />
      Скрытое определение
    </label>}
    {!canPublish && <p>{draft.isHidden ? 'Скрытое определение' : 'Открытое определение'}</p>}
    {draft.kind === 'Item' && <>
      <Field label="Единица количества" htmlFor={`${idPrefix}-quantity-unit`}>
        {readOnly
          ? <p>{draft.quantityUnit === 'Whole' ? 'Целое' : draft.quantityUnit === 'Fractional' ? 'Дробное' : 'Единичное'}</p>
          : <Select id={`${idPrefix}-quantity-unit`} value={draft.quantityUnit ?? 'Whole'} disabled={disabled} onChange={event => update({ quantityUnit: event.target.value as QuantityUnit })}>
            <option value="Whole">Целое</option>
            <option value="Fractional">Дробное</option>
            <option value="Single">Единичное</option>
          </Select>}
      </Field>
      <label>
        <Checkbox checked={draft.allowNegative} disabled={disabled || readOnly} onChange={event => update({ allowNegative: event.target.checked })} />
        Разрешить отрицательное количество
      </label>
    </>}
    <Field label="Описание" htmlFor={`${idPrefix}-description`}>
      {readOnly
        ? <p>{draft.description || 'Описание отсутствует.'}</p>
        : <Textarea id={`${idPrefix}-description`} value={draft.description} disabled={disabled} onChange={event => update({ description: event.target.value })} />}
    </Field>
    <CatalogAttributeValuesEditor
      definitions={definitions}
      values={draft.attributes}
      onChange={attributes => update({ attributes })}
      onValidityChange={setInvalidAttributes}
      disabled={disabled}
      readOnly={readOnly}
      diagnostics={diagnostics}
    />
    {invalid && <p role="alert">Проверьте название и значения атрибутов.</p>}
  </div>;
};

export default CatalogDefinitionFields;
