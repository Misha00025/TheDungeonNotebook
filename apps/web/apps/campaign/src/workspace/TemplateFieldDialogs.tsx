import React, { useEffect, useId, useState } from 'react';
import { ActionRow, Button, DataTable, FormGrid, IconButton, Input, ModalPortal, Select, Textarea } from '@tdn/shared';
import type { ChoiceOption, FieldReference, JsonValue, ValueType, VirtualFieldInput } from './types';
import { stringifyJson } from './json';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { ApiError } from './Feedback';
import { ValueInput, validateFieldValue } from './ValueInput';

type DialogProps = { label: string; disabled: boolean; onClose: () => void };
type DescriptionProps = DialogProps & { value: string; onApply: (value: string) => void };
type OptionsProps = DialogProps & { options: ChoiceOption[]; onApply: (options: ChoiceOption[]) => void };
type ChoiceField = { valueType: ValueType; options: ChoiceOption[] };
type ChoiceProps = DialogProps & { field: ChoiceField; value: JsonValue; onApply: (value: JsonValue) => void };
type TemplateFieldSource = { id: string; title: string; kind: 'Base' | 'Virtual' };
type VirtualLinksUpdate = Pick<VirtualFieldInput, 'formulaId' | 'bindings' | 'parentBaseFieldId' | 'parentVirtualFieldId'>;
type LinksProps = DialogProps & {
  campaignId: number;
  field: VirtualFieldInput;
  sources: TemplateFieldSource[];
  onApply: (update: VirtualLinksUpdate) => void;
};

const differs = (left: unknown, right: unknown) => stringifyJson(left) !== stringifyJson(right);
const sourceValue = (source: TemplateFieldSource) => `${source.kind}:${source.id}`;
const sourceLabel = (source: TemplateFieldSource) => `${source.kind === 'Base' ? 'Базовое' : 'Виртуальное'}: ${source.title}`;

function useDialogDirty(ownerPrefix: string, draft: unknown, initial: unknown) {
  const id = useId();
  useDirtyDraft(`${ownerPrefix}-${id}`, differs(draft, initial));
}

function DialogActions({ disabled, onApply, onClose }: { disabled: boolean; onApply: () => void; onClose: () => void }) {
  return <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={disabled} onClick={onApply}>Применить</Button><Button type="button" onClick={onClose}>Отмена</Button></ActionRow>;
}

export function TemplateDescriptionDialog({ label, value, disabled, onClose, onApply }: DescriptionProps) {
  const [draft, setDraft] = useState(value);
  useDialogDirty('template-description-dialog', draft, value);
  return <ModalPortal isOpen onClose={onClose} title={`Описание поля ${label}`}>
    <Textarea aria-label="Описание поля" rows={6} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} />
    <DialogActions disabled={disabled} onApply={() => onApply(draft)} onClose={onClose} />
  </ModalPortal>;
}

export function TemplateOptionsDialog({ label, options, disabled, onClose, onApply }: OptionsProps) {
  const [draft, setDraft] = useState(() => options.map(option => ({ ...option })));
  useDialogDirty('template-options-dialog', draft, options);
  const update = (index: number, patch: Partial<ChoiceOption>) => setDraft(current => current.map((option, itemIndex) => itemIndex === index ? { ...option, ...patch } : option));
  return <ModalPortal isOpen onClose={onClose} title={`Варианты поля ${label}`} size="wide">
    <DataTable aria-label={`Варианты поля ${label}`}>
      <thead><tr><th scope="col">Ключ</th><th scope="col">Название</th><th scope="col">Действия</th></tr></thead>
      <tbody>{draft.map((option, index) => <tr key={index}>
        <td><Input aria-label={`Ключ варианта ${index + 1}`} value={option.optionKey} disabled={disabled} onChange={event => update(index, { optionKey: event.target.value })} /></td>
        <td><Input aria-label={`Название варианта ${index + 1}`} value={option.title} disabled={disabled} onChange={event => update(index, { title: event.target.value })} /></td>
        <td><IconButton icon="delete" variant="danger" title={`Удалить вариант ${index + 1}`} disabled={disabled} onClick={() => setDraft(current => current.filter((_, itemIndex) => itemIndex !== index))} /></td>
      </tr>)}</tbody>
    </DataTable>
    <ActionRow style={{ gap: '0.5rem' }}><Button type="button" disabled={disabled} onClick={() => setDraft(current => [...current, { optionKey: '', title: '' }])}>Добавить вариант</Button></ActionRow>
    <DialogActions disabled={disabled} onApply={() => onApply(draft.map(option => ({ ...option })))} onClose={onClose} />
  </ModalPortal>;
}

export function TemplateChoiceValueDialog({ label, field, value, disabled, onClose, onApply }: ChoiceProps) {
  const [draft, setDraft] = useState(value);
  const [validationError, setValidationError] = useState(() => validateFieldValue(field, value));
  useDialogDirty('template-choice-value-dialog', draft, value);
  return <ModalPortal isOpen onClose={onClose} title={`Значения поля ${label}`}>
    <ValueInput
      field={field}
      value={draft}
      disabled={disabled}
      onChange={setDraft}
      onValidityChange={setValidationError}
      label={label}
    />
    <DialogActions disabled={disabled || Boolean(validationError)} onApply={() => onApply(draft)} onClose={onClose} />
  </ModalPortal>;
}

export function TemplateVirtualLinksDialog({ label, campaignId, field, sources, disabled, onClose, onApply }: LinksProps) {
  const { api } = useWorkspace();
  const [draft, setDraft] = useState<VirtualFieldInput>(() => ({ ...field, bindings: { ...field.bindings } }));
  const [parameters, setParameters] = useState<string[]>([]);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [formulaError, setFormulaError] = useState<unknown>();
  const [manualName, setManualName] = useState('');
  const [manualKind, setManualKind] = useState<FieldReference['kind']>('Base');
  const [manualId, setManualId] = useState('');
  useDialogDirty('template-virtual-links-dialog', draft, field);

  useEffect(() => {
    let active = true;
    if (!draft.formulaId) {
      setParameters([]);
      setFormulaError(undefined);
      setFormulaLoading(false);
      return () => { active = false; };
    }
    setParameters([]);
    setFormulaError(undefined);
    setFormulaLoading(true);
    api.getFormulaContent(campaignId, draft.formulaId).then(result => {
      if (!active) return;
      setParameters(result.data.parameters);
      setFormulaLoading(false);
    }, error => {
      if (!active) return;
      setParameters([]);
      setFormulaError(error);
      setFormulaLoading(false);
    });
    return () => { active = false; };
  }, [api, campaignId, draft.formulaId]);

  const options = sources.map(source => ({ value: sourceValue(source), label: sourceLabel(source), source }));
  const patch = (changes: Partial<VirtualFieldInput>) => setDraft(current => ({ ...current, ...changes }));
  const patchBinding = (name: string, reference?: FieldReference) => setDraft(current => {
    const bindings = { ...current.bindings };
    if (reference) bindings[name] = reference;
    else delete bindings[name];
    return { ...current, bindings };
  });
  const parentValue = draft.parentBaseFieldId ? `Base:${draft.parentBaseFieldId}` : draft.parentVirtualFieldId ? `Virtual:${draft.parentVirtualFieldId}` : '';
  const parentUnknown = Boolean(parentValue && !options.some(option => option.value === parentValue));
  const storedBindings = Object.entries(draft.bindings).filter(([name]) => !parameters.includes(name));

  const applyManualBinding = () => {
    if (!manualName || !manualId) return;
    patchBinding(manualName, { kind: manualKind, fieldId: manualId });
    setManualName('');
    setManualId('');
  };

  return <ModalPortal isOpen onClose={onClose} title={`Связи поля ${label}`} size="wide">
    <FormGrid minColumnWidth="14rem">
      <label>ID формулы<Input aria-label="ID формулы" value={draft.formulaId} disabled={disabled} onChange={event => patch({ formulaId: event.target.value })} /></label>
      <label>Родитель<Select aria-label="Родитель" value={parentValue} disabled={disabled} onChange={event => {
        const value = event.target.value;
        const source = options.find(option => option.value === value)?.source;
        if (!value) patch({ parentBaseFieldId: null, parentVirtualFieldId: null });
        else if (source?.kind === 'Base') patch({ parentBaseFieldId: source.id, parentVirtualFieldId: null });
        else if (source?.kind === 'Virtual') patch({ parentBaseFieldId: null, parentVirtualFieldId: source.id });
      }}>
        <option value="">Нет</option>
        {parentUnknown && <option value={parentValue}>Недоступный источник</option>}
        {options.map(option => <option key={`parent-${option.value}`} value={option.value}>{option.label}</option>)}
      </Select></label>
    </FormGrid>
    {formulaLoading && <p>Загрузка параметров формулы…</p>}
    {Boolean(formulaError) && <><ApiError error={formulaError} /><p>Определения недоступны для чтения; сохранённые связи можно редактировать вручную.</p></>}
    {parameters.map(name => {
      const reference = draft.bindings[name];
      const value = reference ? `${reference.kind}:${reference.fieldId}` : '';
      const unknown = Boolean(reference && !options.some(option => option.value === value));
      return <label key={name}>Параметр {name}<Select aria-label={`Параметр ${name}`} value={value} disabled={disabled} onChange={event => {
        const selected = options.find(option => option.value === event.target.value)?.source;
        patchBinding(name, selected ? { kind: selected.kind, fieldId: selected.id } : undefined);
      }}>
        <option value="">Не связан</option>
        {unknown && <option value={value}>Недоступный источник</option>}
        {options.map(option => <option key={`${name}-${option.value}`} value={option.value}>{option.label}</option>)}
      </Select></label>;
    })}
    {storedBindings.map(([name, reference]) => <fieldset key={`stored-${name}`}>
      <legend>Сохранённая неизвестная связь</legend>
      <FormGrid minColumnWidth="12rem">
        <label>Имя параметра<Input aria-label={`Имя параметра ${name}`} value={name} disabled={disabled} onChange={event => {
          const bindings = { ...draft.bindings };
          delete bindings[name];
          bindings[event.target.value] = reference;
          patch({ bindings });
        }} /></label>
        <label>Тип источника<Select aria-label={`Тип источника ${name}`} value={reference.kind} disabled={disabled} onChange={event => patchBinding(name, { ...reference, kind: event.target.value as FieldReference['kind'] })}><option value="Base">Base</option><option value="Virtual">Virtual</option></Select></label>
        <label>ID поля<Input aria-label={`ID поля ${name}`} value={reference.fieldId} disabled={disabled} onChange={event => patchBinding(name, { ...reference, fieldId: event.target.value })} /></label>
        <IconButton icon="delete" variant="danger" title={`Удалить связь ${name}`} disabled={disabled} onClick={() => patchBinding(name)} />
      </FormGrid>
    </fieldset>)}
    <fieldset>
      <legend>Добавить связь вручную</legend>
      <FormGrid minColumnWidth="12rem">
        <label>Имя параметра<Input aria-label="Новое имя параметра" value={manualName} disabled={disabled} onChange={event => setManualName(event.target.value)} /></label>
        <label>Тип источника<Select aria-label="Новый тип источника" value={manualKind} disabled={disabled} onChange={event => setManualKind(event.target.value as FieldReference['kind'])}><option value="Base">Base</option><option value="Virtual">Virtual</option></Select></label>
        <label>ID поля<Input aria-label="Новый ID поля" value={manualId} disabled={disabled} onChange={event => setManualId(event.target.value)} /></label>
        <Button type="button" disabled={disabled || !manualName || !manualId} onClick={applyManualBinding}>Добавить связь</Button>
      </FormGrid>
    </fieldset>
    <DialogActions disabled={disabled} onApply={() => onApply({ formulaId: draft.formulaId, bindings: { ...draft.bindings }, parentBaseFieldId: draft.parentBaseFieldId, parentVirtualFieldId: draft.parentVirtualFieldId })} onClose={onClose} />
  </ModalPortal>;
}

export type { ChoiceField, DescriptionProps as TemplateDescriptionDialogProps, OptionsProps as TemplateOptionsDialogProps, ChoiceProps as TemplateChoiceValueDialogProps, LinksProps as TemplateVirtualLinksDialogProps, TemplateFieldSource, VirtualLinksUpdate };
