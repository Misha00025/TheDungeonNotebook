import React from 'react';
import type { CatalogAttributeDefinition, CatalogContentEnvelope, CatalogMetadata } from './catalogTypes';
import { CatalogDefinitionSettingsReadout } from './CatalogDefinitionFields';
import CatalogEntryDetails from './CatalogEntryDetails';
import styles from './CatalogDefinitionFields.module.css';

export type CatalogDefinitionReadViewProps = {
  metadata: CatalogMetadata;
  content: CatalogContentEnvelope;
  definitions: CatalogAttributeDefinition[];
  showSettings: boolean;
  showVisibility: boolean;
  showEditRules?: boolean;
};

const CatalogDefinitionReadView: React.FC<CatalogDefinitionReadViewProps> = ({ metadata, content, definitions, showSettings, showVisibility, showEditRules = false }) => <div className={styles.readView}>
  {showSettings && <CatalogDefinitionSettingsReadout kind={metadata.kind} isHidden={metadata.isHidden} quantityUnit={metadata.quantityUnit} allowNegative={metadata.allowNegative} showVisibility={showVisibility} />}
  <CatalogEntryDetails description={content.data.description} definitions={definitions} values={content.data.attributes} showEditRules={showEditRules} />
</div>;

export default CatalogDefinitionReadView;
