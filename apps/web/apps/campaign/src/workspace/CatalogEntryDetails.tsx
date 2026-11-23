import React from 'react';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogDiagnostic } from './catalogTypes';
import CatalogAttributeReadout from './CatalogAttributeReadout';
import styles from './CatalogDefinitionFields.module.css';

export type CatalogEntryDetailsProps = {
  description: string;
  definitions: CatalogAttributeDefinition[];
  values: CatalogAttributeOccurrence[];
  diagnostics?: CatalogDiagnostic[];
  showEditRules?: boolean;
};

export const CatalogEntryDetails: React.FC<CatalogEntryDetailsProps> = ({ description, definitions, values, diagnostics, showEditRules = false }) => <div className={styles.details}>
  <section><h3>Описание</h3><p className={styles.description}>{description || 'Описание отсутствует.'}</p></section>
  <section><h3>Характеристики</h3><CatalogAttributeReadout definitions={definitions} values={values} diagnostics={diagnostics} showEditRules={showEditRules} /></section>
</div>;

export default CatalogEntryDetails;
