import { SkillAttribute } from "./groupSkills";

export interface GroupItem {
  id: number;
  name: string;
  description: string;
  attributes?: SkillAttribute[];
  price: number;
  image_link: string | null;
  isSecret: boolean;
}

export interface GroupItemsResponse {
  items: GroupItem[];
}

export interface CreateGroupItemRequest {
  name: string;
  description: string;
  price: number;
  image_link?: string;
}

export interface UpdateGroupItemRequest extends CreateGroupItemRequest {}