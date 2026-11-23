import React, { useId, useRef, useState } from 'react';
import { ActionRow, Button, Field, ModalPortal, Select } from '@tdn/shared';
import { useDirtyDraft } from './Workspace';

type Props = {
  groupLabel: string;
  initialParentKey: string | null;
  choices: { key: string; title: string }[];
  disabled: boolean;
  onApply: (parentKey: string | null) => void;
  onClose: () => void;
};

const CatalogGroupMoveDialog: React.FC<Props> = ({ groupLabel, initialParentKey, choices, disabled, onApply, onClose }) => {
  const id = useId();
  const initialValue = useRef(initialParentKey ?? '');
  const [parentKey, setParentKey] = useState(initialParentKey ?? '');
  const parentAvailable = parentKey === '' || choices.some(choice => choice.key === parentKey);
  useDirtyDraft(`catalog-group-move-${id}`, parentKey !== initialValue.current);

  const apply = () => {
    if (disabled || !parentAvailable) return;
    onApply(parentKey || null);
  };

  return <ModalPortal isOpen onClose={onClose} title={`Переместить группу: ${groupLabel}`} size="compact">
    <Field label="Родительская группа" htmlFor={`${id}-parent`}>
      <Select id={`${id}-parent`} value={parentKey} disabled={disabled} onChange={event => setParentKey(event.target.value)}>
        <option value="">Нет родителя</option>
        {!choices.some(choice => choice.key === parentKey) && parentKey && <option value={parentKey} disabled>Недоступная родительская группа</option>}
        {choices.map(choice => <option key={choice.key} value={choice.key}>{choice.title}</option>)}
      </Select>
    </Field>
    <ActionRow style={{ gap: '0.5rem' }}>
      <Button type="button" disabled={disabled || !parentAvailable} onClick={apply}>Применить</Button>
      <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
    </ActionRow>
  </ModalPortal>;
};

export default CatalogGroupMoveDialog;
