import React, { useEffect, useRef, useState } from 'react';
import { FieldSet } from '@tdn/shared';
import { CatalogDefinitionBasics, CatalogDefinitionSettings } from './CatalogDefinitionFields';
import type { CatalogDefinitionDraft } from './CatalogDefinitionFields';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import styles from './CatalogDefinitionFields.module.css';

export type OwnCatalogDefinitionFieldsProps = {
  draft: CatalogDefinitionDraft;
  onChange: (draft: CatalogDefinitionDraft) => void;
  definitions: CatalogAttributeDefinition[];
  savedAttributes?: CatalogAttributeOccurrence[];
  disabled?: boolean;
  readOnly?: boolean;
  onValidityChange?: (invalid: boolean) => void;
  autoFocusName?: boolean;
};

export const OwnCatalogDefinitionFields: React.FC<OwnCatalogDefinitionFieldsProps> = ({ draft, onChange, definitions, savedAttributes, disabled = false, readOnly = false, onValidityChange, autoFocusName = false }) => {
  const [invalidAttributes, setInvalidAttributes] = useState(false);
  const invalid = !readOnly && (!draft.name.trim() || invalidAttributes);
  const callback = useRef(onValidityChange);
  callback.current = onValidityChange;
  useEffect(() => callback.current?.(invalid), [invalid]);
  return <div className={styles.ownEditor}>
  <CatalogDefinitionBasics draft={draft} onChange={onChange} disabled={disabled} readOnly={readOnly} autoFocusName={autoFocusName} afterName={draft.kind === 'Item' ? <CatalogDefinitionSettings draft={draft} onChange={onChange} canPublish={false} disabled={disabled} readOnly={readOnly} /> : null} />
  <FieldSet className={styles.attributes} legend="Характеристики">
     <CatalogAttributeValuesEditor definitions={definitions} values={draft.attributes} savedValues={savedAttributes} onChange={attributes => onChange({ ...draft, attributes })} onValidityChange={setInvalidAttributes} disabled={disabled} readOnly={readOnly} />
  </FieldSet>
  {invalid && <p role="alert">Проверьте название и значения характеристик.</p>}
</div>;
};

export default OwnCatalogDefinitionFields;
