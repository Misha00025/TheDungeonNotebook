import React from 'react';
import { DataTable } from '@tdn/shared';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';
import { catalogAttributeTags } from './catalogAttributeTags';
import { catalogAttributeIssue } from './catalogModel';
import styles from './CatalogDefinitionFields.module.css';

export type CatalogAttributeReadoutProps = {
  definitions: CatalogAttributeDefinition[];
  values: CatalogAttributeOccurrence[];
  showEditRules?: boolean;
};

export const CatalogAttributeReadout: React.FC<CatalogAttributeReadoutProps> = ({ definitions, values, showEditRules = false }) => {
  const visibleValues = values.filter(occurrence => definitions.some(item => item.id === occurrence.attributeId));
  if (!visibleValues.length) return <p>Характеристик пока нет.</p>;
  return <DataTable aria-label="Характеристики" minWidth="0" className={styles.readout}>
    <thead><tr><th scope="col">Атрибут</th><th scope="col">Значение</th></tr></thead>
    <tbody>{visibleValues.map(occurrence => {
      const definition = definitions.find(item => item.id === occurrence.attributeId);
      const formatted = catalogAttributeTags(definitions, [occurrence])[0]?.values.join('; ') ?? '';
      const issue = definition && catalogAttributeIssue(definition, occurrence);
      return <tr key={occurrence.id}>
        <th scope="row">{definition!.title}</th>
        <td>{formatted || 'Не задано'}
          {issue && <small className={styles.readoutNote}>Значение не соответствует текущей характеристике.</small>}
          {showEditRules && occurrence.editLevel === 'Character' && <small className={styles.readoutNote}>Изменяемый</small>}
        </td>
      </tr>;
    })}</tbody>
  </DataTable>;
};

export default CatalogAttributeReadout;
