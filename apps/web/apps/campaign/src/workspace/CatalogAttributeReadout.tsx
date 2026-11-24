import React from 'react';
import { DataTable, DataTableCell, DataTableNote } from '@tdn/shared';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';
import { catalogAttributeTags } from './catalogAttributeTags';
import { catalogAttributeIssue } from './catalogModel';

export type CatalogAttributeReadoutProps = {
  definitions: CatalogAttributeDefinition[];
  values: CatalogAttributeOccurrence[];
  showEditRules?: boolean;
};

export const CatalogAttributeReadout: React.FC<CatalogAttributeReadoutProps> = ({ definitions, values, showEditRules = false }) => {
  const visibleValues = values.filter(occurrence => definitions.some(item => item.id === occurrence.attributeId));
  if (!visibleValues.length) return <p>Характеристик пока нет.</p>;
  return <DataTable aria-label="Характеристики">
    <thead><tr><DataTableCell as="th" scope="col" sizing="content">Атрибут</DataTableCell><DataTableCell as="th" scope="col">Значение</DataTableCell></tr></thead>
    <tbody>{visibleValues.map(occurrence => {
      const definition = definitions.find(item => item.id === occurrence.attributeId);
      const formatted = catalogAttributeTags(definitions, [occurrence])[0]?.values.join('; ') ?? '';
      const issue = definition && catalogAttributeIssue(definition, occurrence);
      return <tr key={occurrence.id}>
         <DataTableCell as="th" scope="row" sizing="content">{definition!.title}</DataTableCell>
         <DataTableCell preserveWhitespace>{formatted || 'Не задано'}
          {issue && <DataTableNote>Значение не соответствует текущей характеристике.</DataTableNote>}
          {showEditRules && occurrence.editLevel === 'Character' && <DataTableNote>Изменяемый</DataTableNote>}
         </DataTableCell>
      </tr>;
    })}</tbody>
  </DataTable>;
};

export default CatalogAttributeReadout;
