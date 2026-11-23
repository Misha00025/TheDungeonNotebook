import React, { useId, useRef, useState } from 'react';
import { ActionRow, Button, ModalPortal } from '@tdn/shared';
import { useDirtyDraft } from './Workspace';
import { CatalogConditionEditor } from './CatalogConditionEditor';
import type { CatalogAttributeDefinition, CatalogGroupCondition } from './catalogTypes';
import { parseJson, stringifyJson } from './json';

type Props = {
  groupLabel: string;
  initialCondition: CatalogGroupCondition | null;
  definitions: CatalogAttributeDefinition[];
  disabled: boolean;
  onApply: (condition: CatalogGroupCondition | null) => void;
  onClose: () => void;
};

const cloneCondition = (condition: CatalogGroupCondition | null): CatalogGroupCondition | null => condition
  ? parseJson(stringifyJson(condition)) as unknown as CatalogGroupCondition
  : null;

const CatalogGroupConditionDialog: React.FC<Props> = ({ groupLabel, initialCondition, definitions, disabled, onApply, onClose }) => {
  const id = useId();
  const initialValue = useRef(stringifyJson(initialCondition));
  const [condition, setCondition] = useState(() => cloneCondition(initialCondition));
  const [invalid, setInvalid] = useState(false);
  const [touched, setTouched] = useState(false);
  const dirty = stringifyJson(condition) !== initialValue.current || (touched && invalid);
  useDirtyDraft(`catalog-group-condition-${id}`, dirty);
  const apply = () => {
    if (disabled || invalid) return;
    onApply(condition);
  };

  return <ModalPortal isOpen onClose={onClose} title={`Условие: ${groupLabel}`} size="wide">
    <CatalogConditionEditor
      definitions={definitions}
      condition={condition}
      disabled={disabled}
      onChange={setCondition}
      onValidityChange={setInvalid}
      onInteraction={() => setTouched(true)}
    />
    <ActionRow style={{ gap: '0.5rem' }}>
      <Button type="button" disabled={disabled || invalid} onClick={apply}>Применить</Button>
      <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
    </ActionRow>
  </ModalPortal>;
};

export default CatalogGroupConditionDialog;
