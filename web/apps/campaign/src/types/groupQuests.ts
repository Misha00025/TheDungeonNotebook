export type QuestStatus = 'active' | 'completed' | 'failed' | 'cancelled';
export type ObjectiveStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface QuestObjective {
  key: string;
  description: string;
  status: ObjectiveStatus;
}

export interface GroupQuest {
  id: number;
  header: string;
  description: string;
  reward: string[];
  status: QuestStatus;
  objectives: QuestObjective[];
  assignedCharacters: number[];
}

export interface GroupQuestsResponse {
  quests: GroupQuest[];
}

export interface CreateGroupQuestRequest {
  header: string;
  description?: string;
  reward?: string[];
  status?: QuestStatus;
  objectives?: QuestObjective[];
  assignedCharacters?: number[];
}

export interface UpdateGroupQuestRequest extends CreateGroupQuestRequest {}

export interface PatchGroupQuestRequest {
  header?: string;
  description?: string;
  reward?: string[];
  status?: QuestStatus;
  objectives?: QuestObjective[];
  assignedCharacters?: number[];
}
