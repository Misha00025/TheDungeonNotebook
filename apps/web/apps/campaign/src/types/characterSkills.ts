// types/characterSkills.ts
import { GroupSkill } from './groupSkills';

export interface CharacterSkill extends GroupSkill {
  // Можно добавить дополнительные поля, специфичные для персонажа
  characterSkillId?: number;
}

export interface CharacterSkillsResponse {
  skills: CharacterSkill[];
  total: number;
}