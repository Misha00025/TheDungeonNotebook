import React, { useId, useState } from 'react';
import { ActionRow, Button, DataTable, DataTableCell, IconButton, Input, List, ModalPortal, Select, Textarea } from '@tdn/shared';
import type { ChoiceOption, FieldReference, JsonValue, ValueType, VirtualFieldInput } from './types';
import { stringifyJson } from './json';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { ApiError } from './Feedback';
import { ValueInput, validateFieldValue } from './ValueInput';
import { useResource } from './hooks';

type DialogProps = { label: string; disabled: boolean; onClose: () => void };
type DescriptionProps = DialogProps & { value: string; onApply: (value: string) => void };
type OptionsProps = DialogProps & { options: ChoiceOption[]; onApply: (options: ChoiceOption[]) => void };
type ChoiceField = { valueType: ValueType; options: ChoiceOption[] };
type ChoiceProps = DialogProps & { field: ChoiceField; value: JsonValue; onApply: (value: JsonValue) => void };
type TemplateFieldSource = { id: string; title: string; kind: 'Base' | 'Virtual' };
type VirtualLinksUpdate = Pick<VirtualFieldInput, 'bindings'>;
type LinksProps = DialogProps & {
  campaignId: number;
  field: VirtualFieldInput;
  sources: TemplateFieldSource[];
  onApply: (update: VirtualLinksUpdate) => void;
};

const differs = (left: unknown, right: unknown) => stringifyJson(left) !== stringifyJson(right);
const sourceValue = (source: TemplateFieldSource) => `${source.kind}:${source.id}`;

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
      <Textarea variant="multiline" aria-label="Описание поля" rows={6} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} />
    <DialogActions disabled={disabled} onApply={() => onApply(draft)} onClose={onClose} />
  </ModalPortal>;
}

export function TemplateOptionsDialog({ label, options, disabled, onClose, onApply }: OptionsProps) {
  const [draft, setDraft] = useState(() => options.map(option => ({ ...option })));
  useDialogDirty('template-options-dialog', draft, options);
  const update = (index: number, patch: Partial<ChoiceOption>) => setDraft(current => current.map((option, itemIndex) => itemIndex === index ? { ...option, ...patch } : option));
  return <ModalPortal isOpen onClose={onClose} title={`Варианты поля ${label}`} size="wide">
    <DataTable aria-label={`Варианты поля ${label}`}>
      <thead><tr><DataTableCell as="th" scope="col" sizing="editor">Ключ</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Название</DataTableCell><DataTableCell as="th" scope="col" sizing="control">Действия</DataTableCell></tr></thead>
      <tbody>{draft.map((option, index) => <tr key={index}>
        <DataTableCell sizing="editor"><Input variant="embedded" aria-label={`Ключ варианта ${index + 1}`} value={option.optionKey} disabled={disabled} onChange={event => update(index, { optionKey: event.target.value })} /></DataTableCell>
        <DataTableCell sizing="editor"><Input variant="embedded" aria-label={`Название варианта ${index + 1}`} value={option.title} disabled={disabled} onChange={event => update(index, { title: event.target.value })} /></DataTableCell>
        <DataTableCell sizing="control"><IconButton size="small" icon="delete" variant="danger" title={`Удалить вариант ${index + 1}`} disabled={disabled} onClick={() => setDraft(current => current.filter((_, itemIndex) => itemIndex !== index))} /></DataTableCell>
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
      variant="single-line"
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
  const { api, sessionKey } = useWorkspace();
  const formulaId = field.formulaId;
  const resourceKey = `${sessionKey}:${campaignId}:${formulaId}:template-formula-bindings`;
  const formula = useResource(resourceKey, () => api.getFormulaContent(campaignId, formulaId), Boolean(formulaId));
  const [draft, setDraft] = useState<{ scope: string; bindings: VirtualFieldInput['bindings'] }>(() => ({ scope: resourceKey, bindings: { ...field.bindings } }));
  const currentBindings = draft.scope === resourceKey ? draft.bindings : field.bindings;
  const parameters = formula.data?.data?.parameters;
  useDialogDirty('template-virtual-links-dialog', currentBindings, field.bindings);

  const options = sources.map(source => ({ value: sourceValue(source), source }));
  const patchBinding = (name: string, reference?: FieldReference) => setDraft(current => {
    const bindings = { ...(current.scope === resourceKey ? current.bindings : field.bindings) };
    if (reference) Object.defineProperty(bindings, name, { configurable: true, enumerable: true, writable: true, value: reference });
    else delete bindings[name];
    return { scope: resourceKey, bindings };
  });
  const ready = Boolean(formulaId) && !formula.loading && !formula.error && parameters !== undefined;
  const extras = ready ? Object.keys(currentBindings).some(name => !parameters.includes(name)) : false;
  const apply = () => {
    if (!ready || !parameters) return;
    const bindings = Object.fromEntries(parameters.flatMap(name => Object.prototype.hasOwnProperty.call(currentBindings, name) ? [[name, currentBindings[name]]] : []));
    onApply({ bindings });
  };

  return <ModalPortal isOpen onClose={onClose} title={`Связи поля ${label}`} size="compact">
    <List layout="vertical" stretch gap="small">
    {!formulaId && <p>Сначала выберите формулу в строке поля.</p>}
    {formula.loading && <p>Загрузка параметров формулы…</p>}
    {Boolean(formula.error) && <ApiError error={formula.error} onRetry={formula.reload} />}
    {ready && parameters?.length === 0 && <p>Формула не требует входных полей.</p>}
    {ready && extras && <p>Связи с параметрами, которых нет в формуле, будут убраны при применении.</p>}
    {ready && parameters && parameters.length > 0 && <DataTable aria-label="Привязки параметров">
      <thead><tr><DataTableCell as="th" scope="col" sizing="content">Параметр</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Поле</DataTableCell></tr></thead>
      <tbody>{parameters.map(name => {
        const reference = Object.prototype.hasOwnProperty.call(currentBindings, name) ? currentBindings[name] : undefined;
        const value = reference ? `${reference.kind}:${reference.fieldId}` : '';
        const unknown = Boolean(reference && !options.some(option => option.value === value));
        return <tr key={name}>
          <DataTableCell as="th" scope="row" sizing="content">{name}</DataTableCell>
          <DataTableCell sizing="editor"><Select variant="embedded" aria-label={`Параметр ${name}`} value={value} disabled={disabled} onChange={event => {
            const selected = options.find(option => option.value === event.target.value)?.source;
            patchBinding(name, selected ? { kind: selected.kind, fieldId: selected.id } : undefined);
          }}>
            <option value="">Не связан</option>
            {unknown && <option value={value}>Недоступное поле</option>}
            {(['Base', 'Virtual'] as const).map(kind => <optgroup key={kind} label={kind === 'Base' ? 'Базовые поля' : 'Виртуальные поля'}>
              {options.filter(option => option.source.kind === kind).map(option => <option key={`${name}-${option.value}`} value={option.value}>{option.source.title}</option>)}
            </optgroup>)}
          </Select></DataTableCell>
        </tr>;
      })}</tbody>
    </DataTable>}
    <DialogActions disabled={disabled || !ready} onApply={apply} onClose={onClose} />
    </List>
  </ModalPortal>;
}

export type { ChoiceField, DescriptionProps as TemplateDescriptionDialogProps, OptionsProps as TemplateOptionsDialogProps, ChoiceProps as TemplateChoiceValueDialogProps, LinksProps as TemplateVirtualLinksDialogProps, TemplateFieldSource, VirtualLinksUpdate };
