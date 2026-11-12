export interface TemplateField {
    name: string;
    value: number;
    maxValue?: number;
    description: string;
    formula?: string;
    modifierFormula?: string;
  }
  
  export interface TemplateGroup {
    id: number;
    name: string;
    icon: string | null;
  }
  
  export interface CharacterTemplate {
    id: number;
    name: string;
    description: string;
    fields: Record<string, TemplateField>;
    group: TemplateGroup;
  }
  
  export interface CharacterTemplatesResponse {
    templates: CharacterTemplate[];
  }
  
  export interface CreateTemplateRequest {
    name: string;
    description: string;
    fields: Record<string, TemplateField>;
  }
  
  export interface UpdateTemplateRequest extends CreateTemplateRequest {}