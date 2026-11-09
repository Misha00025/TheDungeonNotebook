// types/groupSkills.ts
export interface SkillAttribute {
  key: string;
  name: string;
  description?: string;
  value: string;
}

export interface GroupSkill {
  id: number;
  name: string;
  description: string;
  attributes: SkillAttribute[];
  isSecret: boolean;
}

export interface GroupSkillsResponse {
  skills: GroupSkill[];
  total: number;
}

export interface SkillAttributeDefinition {
  key: string;
  name: string;
  description?: string;
  isFiltered: boolean;
  knownValues: string[];
}

export interface SkillAttributesResponse {
  attributes: SkillAttributeDefinition[];
  total: number;
}

export interface CreateGroupSkillRequest {
  name: string;
  description: string;
  attributes: SkillAttribute[];
}

export interface UpdateGroupSkillRequest extends CreateGroupSkillRequest {}

export interface CreateSkillAttributeRequest {
  key: string;
  name: string;
  description?: string;
  isFiltered?: boolean;
}

export interface SkillGroup {
  name: string;
  attributeKey: string;
  skills: GroupSkill[];
  children: SkillGroup[];
}