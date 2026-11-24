import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, DataTableActions, DataTableCell, DataTableNote, IconButton, ModalPortal, Select } from '@tdn/shared';
import { useDirtyDraft } from './Workspace';
import type { JsonValue } from './types';
import type { CatalogAttributeDefinition, CatalogGroupCondition } from './catalogTypes';
import { catalogAttributeField, catalogValueLabel, createConditionLeaf, defaultTypedValue } from './catalogModel';
import { stringifyJson } from './json';
import { ValueInput, validateFieldValue } from './ValueInput';

type ConditionOperator = CatalogGroupCondition['operator'];
type LeafOperator = Extract<ConditionOperator, 'exists' | 'eq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'>;

export type CatalogConditionEditorProps = {
  definitions: CatalogAttributeDefinition[];
  condition: CatalogGroupCondition | null;
  onChange: (condition: CatalogGroupCondition | null) => void;
  disabled?: boolean;
  onValidityChange?: (invalid: boolean) => void;
  onInteraction?: () => void;
};

const operatorLabels: Record<ConditionOperator | 'none', string> = {
  none: 'Без условия',
  all: 'Все условия',
  any: 'Любое условие',
  not: 'Не соответствует условию',
  exists: 'Атрибут существует',
  eq: 'Равно',
  contains: 'Содержит',
  gt: 'Больше',
  gte: 'Больше или равно',
  lt: 'Меньше',
  lte: 'Меньше или равно',
};

const leafOperators: LeafOperator[] = ['exists', 'eq', 'contains', 'gt', 'gte', 'lt', 'lte'];
const conditionOperators: ConditionOperator[] = [...leafOperators, 'all', 'any', 'not'];
const numericOperators = new Set<ConditionOperator>(['gt', 'gte', 'lt', 'lte']);

function getAtPath(root: CatalogGroupCondition | null | undefined, path: number[]): CatalogGroupCondition | undefined {
  let current: CatalogGroupCondition | null | undefined = root;
  for (const index of path) current = current?.children?.[index];
  return current ?? undefined;
}

function sameCondition(left?: CatalogGroupCondition, right?: CatalogGroupCondition): boolean {
  if (!left || !right) return left === right;
  return stringifyJson(left) === stringifyJson(right);
}

function isCompound(operator: ConditionOperator): operator is 'all' | 'any' | 'not' {
  return operator === 'all' || operator === 'any' || operator === 'not';
}

function makeCondition(operator: ConditionOperator, definition?: CatalogAttributeDefinition): CatalogGroupCondition {
  if (operator === 'all' || operator === 'any' || operator === 'not') {
    return { operator, children: [createConditionLeaf('eq')] };
  }
  return createConditionLeaf(operator, definition);
}

type NodeProps = {
  node: CatalogGroupCondition;
  baseline?: CatalogGroupCondition;
  path: number[];
  definitions: CatalogAttributeDefinition[];
  definitionById: Map<string, CatalogAttributeDefinition>;
  disabled: boolean;
  isRoot?: boolean;
  idPrefix: string;
  onInteraction: () => void;
  onChange: (node: CatalogGroupCondition) => void;
  onRootOperatorChange?: (operator: string) => void;
  onRemove?: () => void;
  canRemove: boolean;
  onValidityChange: (key: string, invalid: boolean) => void;
};

const ConditionNodeEditor: React.FC<NodeProps> = ({
  node,
  baseline,
  path,
  definitions,
  definitionById,
  disabled,
  isRoot = false,
  idPrefix,
  onInteraction,
  onChange,
  onRootOperatorChange,
  onRemove,
  canRemove,
  onValidityChange,
}) => {
  const key = path.join('.') || 'root';
  const unchanged = sameCondition(node, baseline);
  const [childValidity, setChildValidity] = useState<Record<string, boolean>>({});
  const [inputInvalid, setInputInvalid] = useState(false);
  const [choiceDraft, setChoiceDraft] = useState<{ value: JsonValue; initialValue: JsonValue; attributeId: string; typeKey: string; options: CatalogAttributeDefinition['options']; operator: ConditionOperator }>();
  const numericInputTouched = useRef(false);
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  const definition = node.attributeId ? definitionById.get(node.attributeId) : undefined;
  const currentField = node.operator === 'contains'
    ? definition?.typeKey === 'string'
      ? catalogAttributeField(definition)
      : definition?.typeKey === 'multiChoice'
        ? { valueType: 'SingleChoice' as const, options: definition.options }
        : undefined
    : catalogAttributeField(definition);
  const currentValueValid = node.operator === 'exists'
    ? Boolean(definition)
    : Boolean(currentField && node.value !== undefined && validateFieldValue(currentField, node.value) === undefined);
  const stale = !isCompound(node.operator) && (!definition
    || (node.operator !== 'exists' && !currentValueValid)
    || (numericOperators.has(node.operator) && definition?.typeKey !== 'integer' && definition?.typeKey !== 'number'));
  const children = isCompound(node.operator) ? node.children ?? [] : [];
  const childKeys = children.map((_, index) => [...path, index].join('.') || 'root');
  const relevantChildValidity = Object.entries(childValidity)
    .filter(([childKey]) => childKeys.includes(childKey));
  const ownInvalid = useMemo(() => {
    if (isCompound(node.operator)) {
      if (node.operator === 'not' && children.length !== 1) return true;
      if ((node.operator === 'all' || node.operator === 'any') && children.length < 1) return true;
      return false;
    }
    if (unchanged && stale) return false;
    if (!node.attributeId || !definition) return true;
    if (node.operator === 'exists') return false;
    if (!currentValueValid) return true;
    if (numericOperators.has(node.operator) && definition.typeKey !== 'integer' && definition.typeKey !== 'number') return true;
    return false;
  }, [unchanged, stale, node, children.length, definition, currentValueValid]);
  const invalid = ownInvalid || inputInvalid || relevantChildValidity.some(([, childInvalid]) => childInvalid);
  const choiceDraftDirty = Boolean(choiceDraft && stringifyJson(choiceDraft.value) !== stringifyJson(choiceDraft.initialValue));
  useDirtyDraft(`catalog-condition-choice-${idPrefix}-${key}`, choiceDraftDirty);

  useEffect(() => {
    numericInputTouched.current = false;
    setInputInvalid(false);
  }, [node.operator, node.attributeId]);

  useEffect(() => {
    validityCallback.current(key, invalid);
  }, [key, invalid, node]);

  const updateAttribute = (attributeId: string) => {
    const selected = definitionById.get(attributeId);
    if (!selected) {
      onChange({ operator: node.operator });
      return;
    }
    const next = createConditionLeaf(node.operator as LeafOperator, selected);
    onChange(next);
  };

  const refresh = () => {
    if (!definition || disabled) return;
    if (node.operator === 'exists') {
      onChange({ operator: 'exists', attributeId: definition.id });
      return;
    }
    onChange(createConditionLeaf(node.operator as LeafOperator, definition));
  };

  const updateChild = (index: number, child: CatalogGroupCondition) => {
    const nextChildren = [...children];
    nextChildren[index] = child;
    onChange({ operator: node.operator, children: nextChildren });
  };

  const changeNodeOperator = (operator: ConditionOperator) => {
    const selectedDefinition = node.attributeId ? definitionById.get(node.attributeId) : undefined;
    validityCallback.current(key, false);
    onChange(makeCondition(operator, selectedDefinition));
  };

  const addChild = () => {
    if (disabled || (node.operator === 'not' && children.length > 0)) return;
    onChange({ operator: node.operator, children: [...children, createConditionLeaf('eq')] });
  };

  const removeChild = (index: number) => {
    if (disabled || (node.operator === 'not' && children.length <= 1)) return;
    onChange({ operator: node.operator, children: children.filter((_, childIndex) => childIndex !== index) });
  };

  const eligibleDefinitions = node.operator === 'contains'
    ? definitions.filter(item => item.typeKey === 'string' || item.typeKey === 'multiChoice' || item.id === node.attributeId)
    : definitions;
  const rawValue = node.value;
  const defaultValue = definition
    ? node.operator === 'contains'
      ? createConditionLeaf(node.operator, definition).value
      : defaultTypedValue(definition.typeKey, definition.options)
    : undefined;
  const choiceSnapshotMatches = Boolean(choiceDraft && choiceDraft.attributeId === node.attributeId
    && choiceDraft.operator === node.operator
    && choiceDraft.typeKey === definition?.typeKey
    && stringifyJson(choiceDraft.options) === stringifyJson(definition?.options));
  const choiceError = currentField && choiceDraft ? validateFieldValue(currentField, choiceDraft.value) : 'Схема атрибута недоступна.';
  const canApplyChoice = Boolean(choiceDraft && !disabled && !stale
    && node.operator !== 'exists' && node.operator !== 'contains' && definition?.typeKey === 'multiChoice' && choiceSnapshotMatches && !choiceError);
  const applyChoice = () => {
    if (!choiceDraft || !canApplyChoice || !definition) return;
    onChange({
      operator: node.operator,
      attributeId: definition.id,
      value: choiceDraft.value,
    });
    setChoiceDraft(undefined);
  };
  const isMultiChoice = node.operator !== 'exists' && node.operator !== 'contains' && definition?.typeKey === 'multiChoice';
  const formatConditionValue = (value: JsonValue, valueDefinition?: CatalogAttributeDefinition, operator: ConditionOperator = node.operator) =>
    operator === 'contains' && valueDefinition?.typeKey === 'multiChoice' && typeof value === 'string'
      ? valueDefinition.options.find(option => option.optionKey === value)?.title ?? 'Неизвестный вариант'
      : catalogValueLabel(value, valueDefinition);
  const fieldValue = node.operator !== 'exists' && definition && !stale && currentField && rawValue !== undefined;
  const leafValue = fieldValue
    ? isMultiChoice
      ? <DataTableActions wrap>
        <span>{formatConditionValue(rawValue!, definition!) || 'Не выбрано'}</span>
        <Button type="button" size="small" variant="secondary" disabled={disabled} onClick={() => setChoiceDraft({
          value: rawValue!,
          initialValue: rawValue!,
          attributeId: definition!.id,
          typeKey: definition!.typeKey,
          options: definition!.options,
          operator: node.operator,
        })}>Выбрать значения</Button>
      </DataTableActions>
      : node.operator === 'contains' && definition?.typeKey === 'multiChoice' && typeof rawValue === 'string'
        ? disabled
          ? <output aria-label={`Значение: ${definition.title}`}>{formatConditionValue(rawValue, definition)}</output>
          : <ValueInput
            field={currentField!}
            value={rawValue}
            label={`Значение: ${definition.title}`}
            onChange={(value: JsonValue) => onChange({ operator: node.operator, attributeId: definition.id, value })}
          />
        : <>
        <ValueInput
          field={currentField!}
          value={rawValue!}
          label={`Значение: ${definition!.title}`}
          compact
          disabled={disabled}
          onChange={(value: JsonValue) => onChange({
            operator: node.operator,
            attributeId: definition!.id,
            value,
          })}
          onRawChange={() => {
            numericInputTouched.current = true;
            onInteraction();
          }}
          onValidityChange={error => {
            if (numericInputTouched.current) setInputInvalid(Boolean(error));
          }}
        />
        {definition!.typeKey === 'boolean' && <span>{rawValue === true ? 'Да' : 'Нет'}</span>}
      </>
    : node.operator !== 'exists' && node.value !== undefined
      ? formatConditionValue(node.value, definition)
      : '—';
  const nodeStatus = stale
    ? 'Условие использует устаревшую или недоступную схему и сохранено без преобразования.'
    : isCompound(node.operator) && ownInvalid
      ? 'Добавьте хотя бы одно условие.'
      : ownInvalid
        ? 'Выберите атрибут и корректное значение условия.'
        : node.operator !== 'exists' && definition && defaultValue === undefined
          ? 'Для этого типа атрибута нельзя создать типизированное условие.'
          : undefined;
  const nodeOperators: ConditionOperator[] = isRoot ? [...leafOperators, 'all', 'any', 'not'] : conditionOperators;

  return <>
    <tr key={key}>
      <DataTableCell sizing="editor" indent={path.length}>
        <Select aria-label={isRoot ? 'Условие включения' : 'Тип условия'} value={node.operator} disabled={disabled} onChange={event => {
          if (isRoot) onRootOperatorChange?.(event.target.value);
          else changeNodeOperator(event.target.value as ConditionOperator);
        }}>
          {isRoot && <option value="none">{operatorLabels.none}</option>}
          {nodeOperators.map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
        </Select>
      </DataTableCell>
      <DataTableCell sizing="editor">{isCompound(node.operator)
        ? '—'
        : <Select aria-label="Атрибут" value={node.attributeId ?? ''} disabled={disabled} onChange={event => updateAttribute(event.target.value)}>
          <option value="">Выберите атрибут</option>
          {eligibleDefinitions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>}
      </DataTableCell>
      <DataTableCell sizing="editor">{isCompound(node.operator) || node.operator === 'exists'
        ? <>—{nodeStatus && <DataTableNote role={ownInvalid ? 'alert' : 'status'} tone={ownInvalid ? 'error' : 'muted'}>{nodeStatus}</DataTableNote>}</>
        : <>{leafValue}{nodeStatus && <DataTableNote role={ownInvalid ? 'alert' : 'status'} tone={ownInvalid ? 'error' : 'muted'}>{nodeStatus}</DataTableNote>}</>}</DataTableCell>
      <DataTableCell sizing="control"><DataTableActions wrap>
        {isCompound(node.operator) && (node.operator !== 'not' || children.length === 0) && <Button type="button" size="small" disabled={disabled} onClick={addChild}>Добавить условие</Button>}
        {!isCompound(node.operator) && stale && definition && <Button type="button" size="small" disabled={disabled} onClick={refresh}>Обновить условие по текущей схеме</Button>}
        {canRemove && onRemove && <IconButton icon="delete" size="small" variant="danger" title="Удалить условие" ariaLabel="Удалить условие" disabled={disabled} onClick={onRemove} />}
      </DataTableActions></DataTableCell>
    </tr>
    {isCompound(node.operator) && children.map((child, index) => <ConditionNodeEditor
      key={`${key}.${index}`}
      node={child}
      baseline={getAtPath(baseline, [index])}
      path={[...path, index]}
      definitions={definitions}
      definitionById={definitionById}
      disabled={disabled}
      isRoot={false}
      idPrefix={idPrefix}
      onInteraction={onInteraction}
      onChange={next => updateChild(index, next)}
      onRemove={() => removeChild(index)}
      canRemove={node.operator !== 'not' || children.length > 1}
      onValidityChange={validityCallback.current}
    />)}
    {choiceDraft && <ModalPortal isOpen onClose={() => setChoiceDraft(undefined)} title={`Значения: ${definition?.title ?? 'атрибут'}`}>
      {!choiceSnapshotMatches || disabled || stale
        ? <p role="status">Условие изменилось или редактирование больше недоступно. Закройте диалог и перечитайте данные.</p>
        : <ValueInput field={currentField!} value={choiceDraft.value} label={`Значение: ${definition?.title ?? 'атрибут'}`} onChange={value => setChoiceDraft(current => current ? { ...current, value } : current)} />}
      {choiceError && choiceSnapshotMatches && !disabled && !stale && <p role="alert">{choiceError}</p>}
      <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={!canApplyChoice} onClick={applyChoice}>Применить</Button><Button type="button" variant="secondary" onClick={() => setChoiceDraft(undefined)}>Отмена</Button></ActionRow>
    </ModalPortal>}
  </>;
};

export const CatalogConditionEditor: React.FC<CatalogConditionEditorProps> = ({
  definitions,
  condition,
  onChange,
  disabled = false,
  onValidityChange,
  onInteraction,
}) => {
  const idPrefix = useId();
  const [nodeValidity, setNodeValidity] = useState<Record<string, boolean>>({});
  const baselineCondition = useRef(condition);
  const previousCondition = useRef(condition);
  const lastEmittedCondition = useRef<CatalogGroupCondition | null | undefined>(undefined);
  const validityCallback = useRef(onValidityChange);
  const interactionCallback = useRef(onInteraction);
  validityCallback.current = onValidityChange;
  interactionCallback.current = onInteraction;
  if (!sameCondition(condition ?? undefined, previousCondition.current ?? undefined)) {
    if (!sameCondition(condition ?? undefined, lastEmittedCondition.current ?? undefined)) {
      baselineCondition.current = condition;
    }
    previousCondition.current = condition;
    lastEmittedCondition.current = undefined;
  }
  const definitionById = useMemo(() => new Map(definitions.map(item => [item.id, item])), [definitions]);
  const activeNodeKeys: string[] = [];
  const collectKeys = (node: CatalogGroupCondition, path: number[] = []) => {
    activeNodeKeys.push(path.join('.') || 'root');
    node.children?.forEach((child, index) => collectKeys(child, [...path, index]));
  };
  if (condition) collectKeys(condition);
  const invalid = condition !== null && Object.entries(nodeValidity).some(([key, value]) => value && activeNodeKeys.includes(key));

  useEffect(() => {
    validityCallback.current?.(invalid);
  }, [invalid]);

  const reportNodeValidity = (key: string, value: boolean) => {
    setNodeValidity(current => {
      if (current[key] === value) return current;
      return { ...current, [key]: value };
    });
  };

  const changeOperator = (value: string) => {
    if (disabled) return;
    if (value === 'none') {
      interactionCallback.current?.();
      lastEmittedCondition.current = null;
      onChange(null);
      baselineCondition.current = null;
      setNodeValidity({});
      return;
    }
    interactionCallback.current?.();
    setNodeValidity({});
    reportNodeValidity('root', false);
    const definition = condition?.attributeId ? definitionById.get(condition.attributeId) : undefined;
    const next = makeCondition(value as ConditionOperator, definition);
    lastEmittedCondition.current = next;
    onChange(next);
  };

  const updateRoot = (next: CatalogGroupCondition) => {
    interactionCallback.current?.();
    lastEmittedCondition.current = next;
    onChange(next);
  };

  return <DataTable aria-label="Условия группы">
      <thead><tr><DataTableCell as="th" scope="col" sizing="editor">Условие</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Атрибут</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Значение</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Действия</DataTableCell></tr></thead>
    <tbody>{condition
      ? <ConditionNodeEditor
        node={condition}
        baseline={baselineCondition.current ?? undefined}
        path={[]}
        definitions={definitions}
        definitionById={definitionById}
        disabled={disabled}
        isRoot
        idPrefix={idPrefix}
        onInteraction={() => interactionCallback.current?.()}
        onChange={updateRoot}
        onRootOperatorChange={changeOperator}
        canRemove={false}
        onValidityChange={reportNodeValidity}
      />
      : <tr>
        <DataTableCell sizing="editor"><Select aria-label="Условие включения" value="none" disabled={disabled} onChange={event => changeOperator(event.target.value)}>
          <option value="none">{operatorLabels.none}</option>
          {([...leafOperators, 'all', 'any', 'not'] as const).map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
        </Select></DataTableCell>
        <DataTableCell sizing="editor">—</DataTableCell><DataTableCell>—</DataTableCell><DataTableCell sizing="control">—</DataTableCell>
      </tr>}
    </tbody>
  </DataTable>;
};

export default CatalogConditionEditor;
