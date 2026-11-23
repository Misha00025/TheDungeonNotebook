import React from 'react';
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
  return <dl className={styles.readout}>
    {visibleValues.map(occurrence => {
      const definition = definitions.find(item => item.id === occurrence.attributeId);
      const formatted = catalogAttributeTags(definitions, [occurrence])[0]?.values.join('; ') ?? '';
      const issue = definition && catalogAttributeIssue(definition, occurrence);
      return <div className={styles.readoutRow} key={occurrence.id}>
        <dt>{definition!.title}</dt>
        <dd>{formatted || 'Не задано'}
          {issue && <small className={styles.readoutNote}>Значение не соответствует текущей характеристике.</small>}
          {showEditRules && <small className={styles.readoutNote}>{occurrence.editLevel === 'Character' ? 'Можно менять у персонажа' : 'Только в каталоге'}</small>}
        </dd>
      </div>;
    })}
  </dl>;
};

export default CatalogAttributeReadout;
