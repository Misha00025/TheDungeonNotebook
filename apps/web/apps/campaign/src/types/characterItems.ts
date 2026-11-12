import { SkillAttribute } from "./groupSkills";

export interface CharacterItem {
  id: number;
  name: string;
  description: string;
  attributes?: SkillAttribute[];
  amount: number;
  price: number;
  image_link: string | null;
  isSecret: boolean;
  isEquipped?: boolean;
}

export interface CharacterItemsResponse {
  items: CharacterItem[];
}

export interface CreateCharacterItemRequest {
  id?: number;
  name: string;
  description: string;
  amount: number;
  price: number;
  image_link?: string;
}

export interface UpdateCharacterItemRequest extends CreateCharacterItemRequest {}