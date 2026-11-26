import type { LosslessNumber } from 'lossless-json';

export type JsonNumber = number | LosslessNumber;
export type JsonValue = null | boolean | string | JsonNumber | JsonValue[] | { [key: string]: JsonValue };
export type Revision = JsonNumber;
export type WorldKind = 'locations' | 'organizations' | 'lore';
export interface WorldMaterial { id: string; campaignId: number; kind: WorldKind; title: string; description: string; tags: string[]; isPublished: boolean; metadataRevision: Revision }
export interface WorldMaterialBody { body: string; bodyVersion: string }
export type ValueType = 'Integer' | 'Number' | 'String' | 'Boolean' | 'SingleChoice' | 'MultiChoice';
export type Importance = 'Background' | 'Secondary' | 'Key';
export type NumericResultType = 'Integer' | 'Number';
export type FieldSourceKind = 'Base' | 'Virtual';
export interface Campaign { id: number; name: string; metadataRevision: Revision }
export interface Permissions { canRead: boolean; canWrite: boolean; canManageAccess: boolean }
export interface Member { campaignId: number; userId: number; isAdmin: boolean; metadataRevision: Revision }
export interface Assignment { campaignId: number; characterId: string; userId: number; canWrite: boolean; metadataRevision: Revision }
export interface DefinitionMetadata { id: string; key: string; campaignId: number; name: string; metadataRevision: Revision }
export interface DefinitionCreate extends DefinitionMetadata { contentRevision: Revision }
export interface TemplateMetadata { campaignId: number; name: string; metadataRevision: Revision }
export interface CharacterMetadata { id: string; campaignId: number; name: string; importance: Importance; metadataRevision: Revision }
export interface User { id: number; nickname: string; visibleName: string; imageLink?: string }
export interface ChoiceOption { optionKey: string; title: string }
export interface BaseFieldInput { id?: string; key: string; title: string; description: string; valueType: ValueType; value: JsonValue; options: ChoiceOption[] }
export interface BaseField { id: string; key: string; title: string; description: string; valueType: ValueType; typeRevision: Revision; value: JsonValue; options: ChoiceOption[] }
export interface EffectiveBaseField { id: string; key: string; title: string; description: string; valueType: ValueType; typeRevision: Revision; options: ChoiceOption[]; effectiveValue: JsonValue; isExplicit: boolean }
export interface FieldReference { kind: FieldSourceKind; fieldId: string }
export interface VirtualFieldInput { id?: string; key: string; title: string; description: string; resultType: NumericResultType; formulaId: string; bindings: Record<string, FieldReference>; parentBaseFieldId?: string | null; parentVirtualFieldId?: string | null }
export interface VirtualField extends Omit<VirtualFieldInput, 'id'> { id: string }
export interface TemplateContent { description: string; baseFields: BaseField[]; virtualFields: VirtualField[] }
export interface ContentEnvelope<T> { campaignId: number; resourceId: string; contentRevision: Revision; data: T }
export interface TemplateContentEnvelope { campaignId: number; contentRevision: Revision; data: TemplateContent }
export interface BasicSheet { contentRevision: Revision; templateContentRevision: Revision; description: string; baseFields: EffectiveBaseField[] }
export interface Diagnostic { code: string; message: string }
export interface FormulaRevision { id: string; contentRevision: Revision }
export interface ComputedField { id: string; key: string; title: string; description: string; resultType: NumericResultType; value: JsonValue; diagnostic: Diagnostic | null }
export interface ComputedSheet extends BasicSheet { formulaContentRevisions: FormulaRevision[]; virtualFields: ComputedField[] }
export interface FormulaContent { expression: string; parameters: string[] }
export interface FormulaMetadata extends DefinitionMetadata {}
export interface ViewNodeBase { nodeKey: string; title: string; params: JsonValue; children: ViewNode[] }
export interface LayoutNode extends ViewNodeBase { kind: 'layout' }
export interface WidgetSource { kind: FieldSourceKind; fieldId: string }
export interface WidgetNode extends ViewNodeBase { kind: 'widget'; sources: WidgetSource[]; format: string }
export type ViewNode = LayoutNode | WidgetNode;
export interface ViewContent { roots: ViewNode[] }
export interface ViewMetadata extends DefinitionMetadata {}
export interface Presentation { contentRevision: Revision; defaults: Record<string, string>; contextParams: Record<string, JsonValue> }
export interface PresentationEnvelope extends Presentation {}
export interface ResolvedPresentation { contextKey: string; viewMetadata: ViewMetadata; viewContent: ContentEnvelope<ViewContent>; contextParams: JsonValue | null; contentRevision: Revision }
export interface ViewSourcesResponse { viewContentRevision: Revision; contentRevision: Revision; templateContentRevision: Revision; formulaContentRevisions: FormulaRevision[]; widgets: { nodeKey: string; sources: { sourceIndex: number; source: WidgetSource; value: JsonValue | null; diagnostic: { code: string } | null }[] }[] }
export interface FormulaContentEnvelope extends ContentEnvelope<FormulaContent> {}
export interface ViewContentEnvelope extends ContentEnvelope<ViewContent> {}
export interface CharacterSheetEnvelope extends BasicSheet {}
export interface VirtualFieldsEnvelope { contentRevision: Revision; virtualFields: VirtualField[] }
export interface OverridesEnvelope { contentRevision: Revision; overrides: { virtualFieldId: string; expression: string }[] }
export interface ContentRevisionDto { contentRevision: Revision }
