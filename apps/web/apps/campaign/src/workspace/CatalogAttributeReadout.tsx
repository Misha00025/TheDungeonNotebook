import React from 'react';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogDiagnostic } from './catalogTypes';
import { catalogAttributeTags } from './catalogAttributeTags';
import styles from './CatalogDefinitionFields.module.css';

export type CatalogAttributeReadoutProps = {
  definitions: CatalogAttributeDefinition[];
  values: CatalogAttributeOccurrence[];
  diagnostics?: CatalogDiagnostic[];
  showEditRules?: boolean;
};

export const CatalogAttributeReadout: React.FC<CatalogAttributeReadoutProps> = ({ definitions, values, diagnostics = [], showEditRules = false }) => {
  if (!values.length) return <p>Характеристик пока нет.</p>;
  const diagnosticIds = new Set(diagnostics.map(item => item.occurrenceId));
  return <dl className={styles.readout}>
    {values.map(occurrence => {
      const definition = definitions.find(item => item.id === occurrence.attributeId);
      const formatted = catalogAttributeTags(definitions, [occurrence])[0]?.values.join('; ') ?? '';
      return <div className={styles.readoutRow} key={occurrence.id}>
        <dt>{definition?.title ?? 'Неизвестный атрибут'}</dt>
        <dd>{formatted || 'Не задано'}
          {diagnosticIds.has(occurrence.id) && <small className={styles.readoutNote}>Значение требует проверки</small>}
          {showEditRules && <small className={styles.readoutNote}>{occurrence.editLevel === 'Character' ? 'Можно менять у персонажа' : 'Только в каталоге'}</small>}
        </dd>
      </div>;
    })}
  </dl>;
};

export default CatalogAttributeReadout;
