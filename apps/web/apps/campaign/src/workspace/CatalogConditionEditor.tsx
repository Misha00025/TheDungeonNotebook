import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Field, FieldSet, Select } from '@tdn/shared';
import type { JsonValue } from './types';
import type { CatalogAttributeDefinition, CatalogGroupCondition } from './catalogTypes';
import { catalogValueLabel, catalogValueType, createConditionLeaf, defaultTypedValue } from './catalogModel';
import { stringifyJson } from './json';
import { ValueInput, validateFieldValue } from './ValueInput';

type ConditionOperator = CatalogGroupCondition['operator'];
type LeafOperator = Extract<ConditionOperator, 'exists' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte'>;

export type CatalogConditionEditorProps = {
  definitions: CatalogAttributeDefinition[];
  condition: CatalogGroupCondition | null;
  onChange: (condition: CatalogGroupCondition | null) => void;
  disabled?: boolean;
  onValidityChange?: (invalid: boolean) => void;
  onInteraction?: () => void;
  allowInactiveAttributeIds?: string[];
};

const operatorLabels: Record<ConditionOperator | 'none', string> = {
  none: 'Без условия',
  all: 'Все условия',
  any: 'Любое условие',
  not: 'Не соответствует условию',
  exists: 'Атрибут существует',
  eq: 'Равно',
  gt: 'Больше',
  gte: 'Больше или равно',
  lt: 'Меньше',
  lte: 'Меньше или равно',
};

const leafOperators: LeafOperator[] = ['exists', 'eq', 'gt', 'gte', 'lt', 'lte'];
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
  allowedInactive: Set<string>;
  disabled: boolean;
  isRoot?: boolean;
  idPrefix: string;
  onInteraction: () => void;
  onChange: (node: CatalogGroupCondition) => void;
  onValidityChange: (key: string, invalid: boolean) => void;
};

const ConditionNodeEditor: React.FC<NodeProps> = ({
  node,
  baseline,
  path,
  definitions,
  definitionById,
  allowedInactive,
  disabled,
  isRoot = false,
  idPrefix,
  onInteraction,
  onChange,
  onValidityChange,
}) => {
  const key = path.join('.') || 'root';
  const controlId = `${idPrefix}-${key}`;
  const unchanged = sameCondition(node, baseline);
  const [childValidity, setChildValidity] = useState<Record<string, boolean>>({});
  const [inputInvalid, setInputInvalid] = useState(false);
  const numericInputTouched = useRef(false);
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  const definition = node.attributeId ? definitionById.get(node.attributeId) : undefined;
  const valueType = node.typeKey ? catalogValueType(node.typeKey) : undefined;
  const schemaMatches = Boolean(definition)
    && node.typeKey === definition?.typeKey
    && String(node.typeRevision) === String(definition?.typeRevision);
  const currentValueValid = node.operator === 'exists'
    ? Boolean(definition)
    : Boolean(valueType && definition && node.value !== undefined
      && validateFieldValue({ valueType, options: definition.options }, node.value) === undefined);
  const stale = Boolean(node.attributeId) && (!definition
    || (node.operator !== 'exists' && (!schemaMatches || !currentValueValid))
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
    if (!definition.isActive && !allowedInactive.has(definition.id)) return true;
    if (node.operator === 'exists') return false;
    if (!schemaMatches || !currentValueValid) return true;
    if (numericOperators.has(node.operator) && definition.typeKey !== 'integer' && definition.typeKey !== 'number') return true;
    return false;
  }, [unchanged, stale, node, children.length, definition, allowedInactive, schemaMatches, currentValueValid]);
  const invalid = ownInvalid || inputInvalid || relevantChildValidity.some(([, childInvalid]) => childInvalid);

  useEffect(() => {
    numericInputTouched.current = false;
    setInputInvalid(false);
  }, [node.operator, node.attributeId, node.typeKey, node.typeRevision]);

  useEffect(() => {
    validityCallback.current(key, invalid);
  }, [key, invalid, node]);

  const updateAttribute = (attributeId: string) => {
    const selected = definitionById.get(attributeId);
    if (!selected || (!selected.isActive && !allowedInactive.has(selected.id))) {
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

  if (isCompound(node.operator)) {
    return <FieldSet legend={operatorLabels[node.operator]}>
      {!isRoot && <Field label="Тип условия" htmlFor={`${controlId}-operator`}>
        <Select id={`${controlId}-operator`} value={node.operator} disabled={disabled} onChange={event => changeNodeOperator(event.target.value as ConditionOperator)}>
          {conditionOperators.map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
        </Select>
      </Field>}
      {children.map((child, index) => <div key={`${key}.${index}`}>
        <ConditionNodeEditor
          node={child}
          baseline={getAtPath(baseline, [index])}
          path={[...path, index]}
          definitions={definitions}
          definitionById={definitionById}
          allowedInactive={allowedInactive}
          disabled={disabled}
          isRoot={false}
          idPrefix={idPrefix}
          onInteraction={onInteraction}
          onChange={next => updateChild(index, next)}
          onValidityChange={validityCallback.current}
        />
        {(node.operator !== 'not' || children.length > 1) && <Button type="button" variant="secondary" disabled={disabled} onClick={() => removeChild(index)}>Удалить условие</Button>}
      </div>)}
      {(node.operator !== 'not' || children.length === 0) && <Button type="button" disabled={disabled} onClick={addChild}>Добавить условие</Button>}
      {ownInvalid && <p role="alert">Добавьте хотя бы одно условие.</p>}
    </FieldSet>;
  }

  const eligibleDefinitions = definitions.filter(item => item.isActive || allowedInactive.has(item.id) || item.id === node.attributeId);
  const currentValueType = definition ? catalogValueType(definition.typeKey) : undefined;
  const rawValue = node.value;
  const defaultValue = definition ? defaultTypedValue(definition.typeKey, definition.options) : undefined;

  return <FieldSet legend={operatorLabels[node.operator]}>
    {!isRoot && <Field label="Тип условия" htmlFor={`${controlId}-operator`}>
      <Select id={`${controlId}-operator`} value={node.operator} disabled={disabled} onChange={event => changeNodeOperator(event.target.value as ConditionOperator)}>
        {conditionOperators.map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
      </Select>
    </Field>}
    {stale && <p>Условие использует устаревшую или недоступную схему и сохранено без преобразования.</p>}
    <Field label="Атрибут" htmlFor={`${controlId}-attribute`}>
      <Select
        id={`${controlId}-attribute`}
        value={node.attributeId ?? ''}
        disabled={disabled}
        onChange={event => updateAttribute(event.target.value)}
      >
        <option value="">Выберите атрибут</option>
        {eligibleDefinitions.map(item => <option key={item.id} value={item.id}>{item.title}{item.isActive ? '' : ' · неактивен'}</option>)}
      </Select>
    </Field>
    {node.operator !== 'exists' && definition && !stale && currentValueType && rawValue !== undefined
      ? <>
        <ValueInput
          field={{ valueType: currentValueType, options: definition.options }}
          value={rawValue}
          label={`Значение: ${definition.title}`}
          disabled={disabled}
          onChange={(value: JsonValue) => onChange({
            operator: node.operator,
            attributeId: definition.id,
            typeKey: definition.typeKey,
            typeRevision: definition.typeRevision,
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
        {definition.typeKey === 'boolean' && <span>{rawValue === true ? 'Да' : 'Нет'}</span>}
      </>
      : node.operator !== 'exists' && node.value !== undefined && <p>{catalogValueLabel(node.value, definition)}</p>}
    {stale && definition && <Button type="button" disabled={disabled} onClick={refresh}>Обновить условие по текущей схеме</Button>}
    {ownInvalid && <p role="alert">Выберите атрибут и корректное значение условия.</p>}
    {node.operator !== 'exists' && definition && defaultValue === undefined && <p role="alert">Для этого типа атрибута нельзя создать типизированное условие.</p>}
  </FieldSet>;
};

export const CatalogConditionEditor: React.FC<CatalogConditionEditorProps> = ({
  definitions,
  condition,
  onChange,
  disabled = false,
  onValidityChange,
  onInteraction,
  allowInactiveAttributeIds = [],
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
  const allowedInactive = useMemo(() => new Set(allowInactiveAttributeIds), [allowInactiveAttributeIds]);
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

  return <section>
    <Field label="Условие включения" htmlFor={`${idPrefix}-condition-operator`}>
      <Select
        id={`${idPrefix}-condition-operator`}
        value={condition?.operator ?? 'none'}
        disabled={disabled}
        onChange={event => changeOperator(event.target.value)}
      >
        {(['none', 'exists', 'eq', 'gt', 'gte', 'lt', 'lte', 'all', 'any', 'not'] as const).map(operator =>
          <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
      </Select>
    </Field>
    {condition && <ConditionNodeEditor
      node={condition}
      baseline={baselineCondition.current ?? undefined}
      path={[]}
      definitions={definitions}
      definitionById={definitionById}
      allowedInactive={allowedInactive}
      disabled={disabled}
      isRoot
      idPrefix={idPrefix}
      onInteraction={() => interactionCallback.current?.()}
      onChange={updateRoot}
      onValidityChange={reportNodeValidity}
    />}
    {invalid && <p role="alert">Условие содержит незаполненные или некорректные поля.</p>}
  </section>;
};

export default CatalogConditionEditor;
