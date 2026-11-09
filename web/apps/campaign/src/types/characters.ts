export interface CharacterShort {
    id: number;
    name: string;
    description: string;
    fields?: Record<string, CharacterField>;
  }
  
  export interface Character {
    id: number;
    name: string;
    description: string;
    fields: Record<string, CharacterField>;
    group: {
      id: number;
      name: string;
      icon: string | null;
    };
    templateId: number;
  }
  
  export interface CharacterField {
    name: string;
    value: number;
    maxValue?: number;
    description: string;
    formula?: string;
    modifier?: number;
    modifierFormula?: string;
  }
  
  export interface CreateCharacterRequest {
    name: string;
    description: string;
    templateId: number;
  }
  
  export interface UpdateCharacterRequest {
    fields: Record<string, Partial<CharacterField> | null>;
  }