export interface GroupSchema {
    type: "items" | "skills";
    groupBy: string[];
}

export interface TemplateCategory {
    name: string;
    fields: string[];
    categories?: TemplateCategory[];
  }

  export interface TemplateSchema {
    categories: TemplateCategory[];
  }