import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from './Workspace';
import type { DefinitionMetadata, FieldReference, VirtualField, VirtualFieldInput } from './types';
import { ApiError } from './Feedback';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import { ActionRow, Button, FieldSet, FormGrid, List, Notification } from '@tdn/shared';

type Source = { id: string; key: string; title: string; kind: 'Base' | 'Virtual' };
type Props = { fields: VirtualFieldInput[]; onChange: (fields: VirtualFieldInput[]) => void; formulas: DefinitionMetadata[]; baseFields: { id: string; key: string; title: string }[]; templateVirtualFields?: VirtualField[]; disabled?: boolean; onValidityChange?: (valid: boolean) => void; campaignId: number; compact?: boolean };
type RowProps = { field: VirtualFieldInput; fieldIndex: number; change: (index: number, update: (field: VirtualFieldInput) => VirtualFieldInput) => void; remove: (index: number) => void; formulas: DefinitionMetadata[]; sources: Source[]; disabled: boolean; campaignId: number; compact: boolean };

const VirtualFieldRow: React.FC<RowProps> = ({ field, fieldIndex, change, remove, formulas, sources, disabled, campaignId, compact }) => {
  const { api } = useWorkspace();
  const [parameters, setParameters] = useState<string[]>([]);
  const [readError, setReadError] = useState<unknown>();
  const [manualParameter, setManualParameter] = useState('');
  const [manualKind, setManualKind] = useState<'Base' | 'Virtual'>('Base');
  const [manualFieldId, setManualFieldId] = useState('');
  useEffect(() => {
    let active = true;
    if (!field.formulaId) { setParameters([]); setReadError(undefined); return () => { active = false; }; }
    setParameters([]);
    setReadError(undefined);
    api.getFormulaContent(campaignId, field.formulaId).then(result => { if (active) setParameters(result.data.parameters); }, error => { if (active) { setParameters([]); setReadError(error); } });
    return () => { active = false; };
  }, [api, campaignId, field.formulaId]);
  const patch = (updates: Partial<VirtualFieldInput>) => change(fieldIndex, current => ({ ...current, ...updates }));
  const patchBinding = (name: string, reference?: FieldReference) => {
    const bindings = { ...field.bindings };
    if (reference) bindings[name] = reference; else delete bindings[name];
    patch({ bindings });
  };
  const referenceOptions = sources.map(source => ({ value: `${source.kind}:${source.id}`, label: `${source.kind}: ${source.title}`, source }));
  const parentValue = field.parentBaseFieldId ? `Base:${field.parentBaseFieldId}` : field.parentVirtualFieldId ? `Virtual:${field.parentVirtualFieldId}` : '';
  const parentUnknown = parentValue && !referenceOptions.some(option => option.value === parentValue);
  const keyControl = <label>Ключ<input className={inputStyles.input} value={field.key} disabled={disabled || Boolean(field.id)} onChange={event => patch({ key: event.target.value })} /></label>;
  const titleControl = <label>Название<input className={inputStyles.input} value={field.title} disabled={disabled} onChange={event => patch({ title: event.target.value })} /></label>;
  const descriptionControl = <label>Описание<textarea className={inputStyles.input} rows={compact ? 1 : undefined} value={field.description} disabled={disabled} onChange={event => patch({ description: event.target.value })} /></label>;
  const resultControl = <label>Результат<select className={inputStyles.input} value={field.resultType} disabled={disabled} onChange={event => patch({ resultType: event.target.value as 'Integer' | 'Number' })}><option>Integer</option><option>Number</option></select></label>;
  const formulaControl = <label>Формула<select className={inputStyles.input} value={formulas.some(item => item.id === field.formulaId) ? field.formulaId : ''} disabled={disabled} onChange={event => patch({ formulaId: event.target.value || field.formulaId })}><option value="">Выберите из списка</option>{formulas.map(formula => <option key={formula.id} value={formula.id}>{formula.name}</option>)}</select></label>;
  const formulaIdControl = <label>ID формулы<input className={inputStyles.input} value={field.formulaId} disabled={disabled} onChange={event => patch({ formulaId: event.target.value })} /></label>;
  const parentControl = <label>Родитель<select className={inputStyles.input} disabled={disabled} value={parentValue} onChange={event => { const [kind, fieldId] = event.target.value.split(':'); patch({ parentBaseFieldId: kind === 'Base' ? fieldId : null, parentVirtualFieldId: kind === 'Virtual' ? fieldId : null }); }}><option value="">Нет</option>{parentUnknown && <option value={parentValue}>Недоступный источник</option>}{referenceOptions.map(item => <option key={`parent:${item.value}`} value={item.value}>{item.label}</option>)}</select></label>;
  const parameterControls = parameters.map(name => { const current = field.bindings[name]; const currentValue = current ? `${current.kind}:${current.fieldId}` : ''; const unknown = current && !referenceOptions.some(option => option.value === currentValue); return <label key={`parameter:${name}`}>Параметр {name}<select className={inputStyles.input} disabled={disabled} value={currentValue} onChange={event => { const option = referenceOptions.find(item => item.value === event.target.value); patchBinding(name, option ? { kind: option.source.kind, fieldId: option.source.id } : undefined); }}><option value="">Не связан</option>{unknown && <option value={currentValue}>Недоступный источник</option>}{referenceOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; });
  const storedBindings = Object.entries(field.bindings).filter(([name]) => !parameters.includes(name)).map(([name, reference]) => {
    const controls = <><label>Имя параметра<input className={inputStyles.input} value={name} disabled={disabled} onChange={event => { const bindings = { ...field.bindings }; delete bindings[name]; bindings[event.target.value] = reference; patch({ bindings }); }} /></label><label>Тип источника<select className={inputStyles.input} value={reference.kind} disabled={disabled} onChange={event => patchBinding(name, { ...reference, kind: event.target.value as 'Base' | 'Virtual' })}><option>Base</option><option>Virtual</option></select></label><label>ID поля<input className={inputStyles.input} value={reference.fieldId} disabled={disabled} onChange={event => patchBinding(name, { ...reference, fieldId: event.target.value })} /></label></>;
    const removeButton = compact ? <ActionRow><Button type="button" disabled={disabled} onClick={() => patchBinding(name)}>Удалить связь</Button></ActionRow> : <button type="button" className={buttonStyles.button} disabled={disabled} onClick={() => patchBinding(name)}>Удалить связь</button>;
    return compact ? <FieldSet key={`stored:${name}`} legend="Сохранённая неизвестная связь"><FormGrid minColumnWidth="9rem">{controls}{removeButton}</FormGrid></FieldSet> : <fieldset key={`stored:${name}`}><legend>Сохранённая неизвестная связь</legend>{controls}{removeButton}</fieldset>;
  });
  const manualControls = <><label>Имя параметра<input className={inputStyles.input} value={manualParameter} disabled={disabled} onChange={event => setManualParameter(event.target.value)} /></label><label>Тип источника<select className={inputStyles.input} value={manualKind} disabled={disabled} onChange={event => setManualKind(event.target.value as 'Base' | 'Virtual')}><option>Base</option><option>Virtual</option></select></label><label>ID поля<input className={inputStyles.input} value={manualFieldId} disabled={disabled} onChange={event => setManualFieldId(event.target.value)} /></label></>;
  const addBindingButton = compact ? <ActionRow><Button type="button" disabled={disabled || !manualParameter || !manualFieldId} onClick={() => { patchBinding(manualParameter, { kind: manualKind, fieldId: manualFieldId }); setManualParameter(''); setManualFieldId(''); }}>Добавить связь</Button></ActionRow> : <button type="button" className={buttonStyles.button} disabled={disabled || !manualParameter || !manualFieldId} onClick={() => { patchBinding(manualParameter, { kind: manualKind, fieldId: manualFieldId }); setManualParameter(''); setManualFieldId(''); }}>Добавить связь</button>;
  const manualBinding = compact ? <FieldSet legend="Добавить связь вручную"><FormGrid minColumnWidth="9rem">{manualControls}{addBindingButton}</FormGrid></FieldSet> : <fieldset><legend>Добавить связь вручную</legend>{manualControls}{addBindingButton}</fieldset>;
  const deleteButton = compact ? <Button type="button" disabled={disabled} onClick={() => remove(fieldIndex)}>Удалить поле</Button> : <button type="button" className={buttonStyles.button} disabled={disabled} onClick={() => remove(fieldIndex)}>Удалить поле</button>;
  if (compact) return <FieldSet legend={field.title || 'Новое виртуальное поле'}><FormGrid minColumnWidth="9rem">{keyControl}{titleControl}{resultControl}{formulaControl}</FormGrid><FormGrid minColumnWidth="9rem">{descriptionControl}{parentControl}</FormGrid>{Boolean(readError) && <><ApiError error={readError} /><Notification kind="warning" eventKey={readError}>Определения недоступны для чтения; связи можно редактировать вручную.</Notification></>}{parameterControls.length > 0 && <FormGrid minColumnWidth="9rem">{parameterControls}</FormGrid>}<details><summary>Дополнительные связи</summary><List layout="vertical" gap="small">{formulaIdControl}{storedBindings}{manualBinding}</List></details><ActionRow>{deleteButton}</ActionRow></FieldSet>;
  return <fieldset className={commonStyles.card}>
    <legend>{field.title || 'Новое виртуальное поле'}</legend>
    {keyControl}{titleControl}{descriptionControl}{resultControl}{formulaControl}{formulaIdControl}
     {Boolean(readError) && <><ApiError error={readError} /><Notification kind="warning" eventKey={readError}>Определения недоступны для чтения; связи можно редактировать вручную.</Notification></>}
    <h4>Связи параметров</h4>
    {parameterControls}{storedBindings}{manualBinding}{parentControl}{deleteButton}
  </fieldset>;
};

export const VirtualFieldsEditor: React.FC<Props> = ({ fields, onChange, formulas, baseFields, templateVirtualFields = [], disabled = false, onValidityChange, campaignId, compact = false }) => {
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  useEffect(() => { validityCallback.current?.(true); }, []);
  const keys = useRef(new WeakMap<object, string>());
  const sequence = useRef(0);
  const getKey = (field: VirtualFieldInput) => {
    if (field.id) return `id:${field.id}`;
    let key = keys.current.get(field);
    if (!key) { key = `new:${++sequence.current}`; keys.current.set(field, key); }
    return key;
  };
  const sources: Source[] = [
    ...baseFields.map(field => ({ ...field, kind: 'Base' as const })),
    ...fields.filter((field): field is VirtualFieldInput & { id: string } => Boolean(field.id)).map(field => ({ id: field.id, key: field.key, title: field.title, kind: 'Virtual' as const })),
    ...templateVirtualFields.filter(field => Boolean(field.id)).map(field => ({ id: field.id, key: field.key, title: field.title, kind: 'Virtual' as const }))
  ].filter((source, index, all) => all.findIndex(item => item.kind === source.kind && item.id === source.id) === index);
  const change = (index: number, update: (field: VirtualFieldInput) => VirtualFieldInput) => onChange(fields.map((field, itemIndex) => {
    if (itemIndex !== index) return field;
    const next = update(field);
    if (!next.id) keys.current.set(next, getKey(field));
    return next;
  }));
  const add = () => { const next: VirtualFieldInput = { key: '', title: '', description: '', resultType: 'Number', formulaId: '', bindings: {} }; getKey(next); onChange([...fields, next]); };
    return <section>{compact ? <List layout="vertical" stretch gap="small">{fields.map((field, index) => <VirtualFieldRow key={getKey(field)} field={field} fieldIndex={index} change={change} remove={itemIndex => onChange(fields.filter((_, i) => i !== itemIndex))} formulas={formulas} sources={sources} disabled={disabled} campaignId={campaignId} compact />)}<Button type="button" disabled={disabled} onClick={add}>Добавить виртуальное поле</Button><p>Новые поля доступны для связей после сохранения.</p></List> : <><h3>Виртуальные поля</h3>{fields.map((field, index) => <VirtualFieldRow key={getKey(field)} field={field} fieldIndex={index} change={change} remove={itemIndex => onChange(fields.filter((_, i) => i !== itemIndex))} formulas={formulas} sources={sources} disabled={disabled} campaignId={campaignId} compact={false} />)}<button type="button" className={buttonStyles.button} disabled={disabled} onClick={add}>Добавить виртуальное поле</button><p>Новые поля доступны для связей после сохранения.</p></>}</section>;
};
export default VirtualFieldsEditor;
