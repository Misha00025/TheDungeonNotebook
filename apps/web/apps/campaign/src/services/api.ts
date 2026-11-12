// Общие (auth/user/settings) клиенты и makeAuthenticatedRequest переехали в @tdn/shared.
import { authAPI, makeAuthenticatedRequest, userAPI, userSettingsAPI } from '@tdn/shared';
export { authAPI, makeAuthenticatedRequest, userAPI, userSettingsAPI };

import { CreateGroupRequest, Group, GroupsResponse } from '../types/group';
import { GroupUser, GroupUsersResponse, SearchUsersResponse, User } from '../types/groupUsers';
import {
  CharacterTemplate,
  CharacterTemplatesResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest
} from '../types/characterTemplates';
import {
  CharacterShort,
  Character,
  CreateCharacterRequest,
  UpdateCharacterRequest
} from '../types/characters';
import { CharacterUser, CharacterUsersResponse } from '../types/characterUsers';
import { CharacterCommand, ExecuteCommandResult } from '../types/characterCommands';
import {
  GroupItem,
  GroupItemsResponse,
  CreateGroupItemRequest,
  UpdateGroupItemRequest
} from '../types/groupItems';
import {
  GroupQuest, GroupQuestsResponse, CreateGroupQuestRequest, PatchGroupQuestRequest
} from '../types/groupQuests';
import {
  CharacterItem,
  CharacterItemsResponse,
  CreateCharacterItemRequest,
  UpdateCharacterItemRequest
} from '../types/characterItems';
import { GroupNote, CreateGroupNoteRequest, UpdateGroupNoteRequest } from '../types/groupNotes';
import { CreateGroupSkillRequest, CreateSkillAttributeRequest, GroupSkill, GroupSkillsResponse, SkillAttributeDefinition, SkillAttributesResponse, UpdateGroupSkillRequest } from '../types/groupSkills';
import { GroupSchema, TemplateSchema } from '../types/groupSchemas';
import { ActionLogResponse } from '../types/actionLog';


export const groupAPI = {
  getGroups: async (): Promise<Group[]> => {
    const response = await makeAuthenticatedRequest('/groups');
    if (!response.ok) {
      throw new Error('Failed to fetch groups');
    }
    const data: GroupsResponse = await response.json();
    return data.groups;
  },

  getGroup: async (groupId: number): Promise<Group> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch group');
    }
    return response.json();
  },

  createGroup: async (groupData: CreateGroupRequest): Promise<Group> => {
    const response = await makeAuthenticatedRequest('/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groupData),
    });

    if (!response.ok) {
      throw new Error('Failed to create group');
    }

    return response.json();
  },

  updateGroup: async (groupId: number, groupData: { name?: string; icon?: string }): Promise<Group> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groupData),
    });

    if (!response.ok) {
      throw new Error('Failed to update group');
    }

    return response.json();
  },

  getSchema: async (groupId: number, schemaType: 'items' | 'skills'): Promise<GroupSchema> => {
    try {
      const response = await makeAuthenticatedRequest(`/groups/${groupId}/schemas/${schemaType}`);
      if (!response.ok) {
        if (response.status === 404) {
          return { type: schemaType, groupBy: [] };
        }
        throw new Error(`Failed to fetch ${schemaType} schema`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error fetching ${schemaType} schema:`, error);
      return { type: schemaType, groupBy: [] };
    }
  },

  updateSchema: async (groupId: number, schemaType: 'items' | 'skills', groupBy: string[]): Promise<GroupSchema> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/schemas/${schemaType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupBy }),
    });
    if (!response.ok) {
      throw new Error(`Failed to update ${schemaType} schema`);
    }
    return response.json();
  },

  getItemsSchema: async (groupId: number): Promise<GroupSchema> => {
    return groupAPI.getSchema(groupId, 'items');
  },

  getSkillsSchema: async (groupId: number): Promise<GroupSchema> => {
    return groupAPI.getSchema(groupId, 'skills');
  },

  updateItemsSchema: async (groupId: number, groupBy: string[]): Promise<GroupSchema> => {
    return groupAPI.updateSchema(groupId, 'items', groupBy);
  },

  updateSkillsSchema: async (groupId: number, groupBy: string[]): Promise<GroupSchema> => {
    return groupAPI.updateSchema(groupId, 'skills', groupBy);
  },

  getTemplateSchema: async (groupId: number): Promise<TemplateSchema> => {
    try {
      const response = await makeAuthenticatedRequest(`/groups/${groupId}/schemas/template`);
      if (!response.ok) {
        if (response.status === 404) {
          return {categories: []};
        }
        throw new Error(`Failed to fetch template schema`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error fetching template schema:`, error);
      return {categories: []};
    }
  },

  updateTemplateSchema: async (groupId: number, schema: TemplateSchema): Promise<TemplateSchema> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/schemas/template`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schema),
    });
    if (!response.ok) {
      throw new Error(`Failed to update template schema`);
    }
    return response.json();
  },

  exportGroup: async (groupId: number): Promise<Record<string, unknown>> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/export`);
    if (!response.ok) {
      throw new Error('Failed to export group data');
    }
    return response.json();
  },

  importGroup: async (groupId: number, data: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to import group data');
    }
    return response.json();
  },

  getCharacterResources: async (groupId: number): Promise<string[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/schemas/characters/resources`);
    if (!response.ok) throw new Error('Failed to fetch character resources');
    const data = await response.json();
    return data.fields ?? [];
  },

  updateCharacterResources: async (groupId: number, fields: string[]): Promise<string[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/schemas/characters/resources`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!response.ok) throw new Error('Failed to update character resources');
    const data = await response.json();
    return data.fields ?? [];
  },
};


export const groupUsersAPI = {
  searchUsers: async (nickname: string): Promise<User[]> => {
    const response = await makeAuthenticatedRequest(`/users?nickname=${encodeURIComponent(nickname)}`);
    if (!response.ok) {
      throw new Error('Failed to search users');
    }
    const data: SearchUsersResponse = await response.json();
    return data.users;
  },

  getGroupUsers: async (groupId: number): Promise<GroupUser[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/users`);
    if (!response.ok) {
      throw new Error('Failed to fetch group users');
    }
    const data: GroupUsersResponse = await response.json();
    return data.users;
  },

  addUserToGroup: async (groupId: number, userId: number, isAdmin: boolean): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isAdmin }),
    });
    if (!response.ok) {
      throw new Error('Failed to add user to group');
    }
  },

  removeUserFromGroup: async (groupId: number, userId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/users/${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to remove user from group');
    }
  },
};


export const characterTemplatesAPI = {
  getTemplates: async (groupId: number): Promise<CharacterTemplate[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/templates`);
    if (!response.ok) {
      throw new Error('Failed to fetch templates');
    }
    const data: CharacterTemplatesResponse = await response.json();
    return data.templates;
  },

  getTemplate: async (groupId: number, templateId: number): Promise<CharacterTemplate> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/templates/${templateId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }
    return response.json();
  },

  createTemplate: async (groupId: number, templateData: CreateTemplateRequest): Promise<CharacterTemplate> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });
    if (!response.ok) {
      throw new Error('Failed to create template');
    }
    return response.json();
  },

  updateTemplate: async (groupId: number, templateId: number, templateData: UpdateTemplateRequest): Promise<CharacterTemplate> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/templates`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });
    if (!response.ok) {
      throw new Error('Failed to update template');
    }
    return response.json();
  },

  deleteTemplate: async (groupId: number, templateId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/templates/${templateId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete template');
    }
  },
};

export const charactersAPI = {
  getCharacters: async (groupId: number): Promise<CharacterShort[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters`);
    if (!response.ok) {
      throw new Error('Failed to fetch characters');
    }
    return response.json();
  },

  getCharacter: async (groupId: number, characterId: number): Promise<Character> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch character');
    }
    return response.json();
  },

  createCharacter: async (groupId: number, characterData: CreateCharacterRequest): Promise<Character> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(characterData),
    });
    if (!response.ok) {
      throw new Error('Failed to create character');
    }
    return response.json();
  },

  updateCharacter: async (groupId: number, characterId: number, characterData: UpdateCharacterRequest): Promise<Character> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(characterData),
    });
    if (!response.ok) {
      throw new Error('Failed to update character');
    }
    return response.json();
  },

  deleteCharacter: async (groupId: number, characterId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete character');
    }
  },
};

export const characterUsersAPI = {
  getCharacterUsers: async (groupId: number, characterId: number): Promise<CharacterUser[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/users`);
    if (!response.ok) {
      throw new Error('Failed to fetch character users');
    }
    const data: CharacterUsersResponse = await response.json();
    return data.users;
  },

  addUserToCharacter: async (groupId: number, characterId: number, userId: number, canWrite: boolean): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ canWrite }),
    });
    if (!response.ok) {
      throw new Error('Failed to add user to character');
    }
  },

  removeUserFromCharacter: async (groupId: number, characterId: number, userId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/users/${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to remove user from character');
    }
  },
};

export const groupItemsAPI = {
  getItems: async (groupId: number): Promise<GroupItem[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/items`);
    if (!response.ok) {
      throw new Error('Failed to fetch group items');
    }
    const data: GroupItemsResponse = await response.json();
    return data.items;
  },

  createItem: async (groupId: number, itemData: CreateGroupItemRequest): Promise<GroupItem> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    });
    if (!response.ok) {
      throw new Error('Failed to create group item');
    }
    return response.json();
  },

  updateItem: async (groupId: number, itemId: number, itemData: UpdateGroupItemRequest): Promise<GroupItem> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    });
    if (!response.ok) {
      throw new Error('Failed to update group item');
    }
    return response.json();
  },

  deleteItem: async (groupId: number, itemId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete group item');
    }
  },
};

export const groupNotesAPI = {
  getNotes: async (groupId: number): Promise<GroupNote[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/notes`);
    if (!response.ok) {
      throw new Error('Failed to fetch group notes');
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data;
    }
    return data?.notes ?? [];
  },

  getNote: async (groupId: number, noteId: number): Promise<GroupNote> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/notes/${noteId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch note');
    }
    return response.json();
  },

  createNote: async (groupId: number, noteData: CreateGroupNoteRequest): Promise<GroupNote> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Header: noteData.header,
        short_description: noteData.short_description,
        Body: noteData.body || null,
        Keywords: noteData.keywords || [],
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to create note');
    }
    return response.json();
  },

  updateNote: async (groupId: number, noteId: number, noteData: UpdateGroupNoteRequest): Promise<GroupNote> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Header: noteData.header,
        short_description: noteData.short_description,
        Body: noteData.body || null,
        Keywords: noteData.keywords || [],
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to update note');
    }
    return response.json();
  },

  deleteNote: async (groupId: number, noteId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/notes/${noteId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete note');
    }
  },
};

export const characterItemsAPI = {
  getCharacterItems: async (groupId: number, characterId: number): Promise<CharacterItem[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/items`);
    if (!response.ok) {
      throw new Error('Failed to fetch character items');
    }
    const data: CharacterItemsResponse = await response.json();
    return data.items;
  },

  createCharacterItem: async (groupId: number, characterId: number, itemData: CreateCharacterItemRequest): Promise<CharacterItem> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    });
    if (!response.ok) {
      throw new Error('Failed to create character item');
    }
    return response.json();
  },

  updateCharacterItem: async (groupId: number, characterId: number, itemId: number, itemData: UpdateCharacterItemRequest): Promise<CharacterItem> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    });
    if (!response.ok) {
      throw new Error('Failed to update character item');
    }
    return response.json();
  },

  deleteCharacterItem: async (groupId: number, characterId: number, itemId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete character item');
    }
  },
};

export const groupSkillsAPI = {
  getSkills: async (groupId: number): Promise<GroupSkill[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills`);
    if (!response.ok) {
      throw new Error('Failed to fetch group skills');
    }
    const data: GroupSkillsResponse = await response.json();
    return data.skills;
  },

  getSkill: async (groupId: number, skillId: number): Promise<GroupSkill> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills/${skillId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch skill');
    }
    return response.json();
  },

  createSkill: async (groupId: number, skillData: CreateGroupSkillRequest): Promise<GroupSkill> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(skillData),
    });
    if (!response.ok) {
      throw new Error('Failed to create skill');
    }
    return response.json();
  },

  updateSkill: async (groupId: number, skillId: number, skillData: UpdateGroupSkillRequest): Promise<GroupSkill> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills/${skillId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(skillData),
    });
    if (!response.ok) {
      throw new Error('Failed to update skill');
    }
    return response.json();
  },

  deleteSkill: async (groupId: number, skillId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills/${skillId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete skill');
    }
  },

  getSkillAttributes: async (groupId: number): Promise<SkillAttributeDefinition[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills/attributes`);
    if (!response.ok) {
      throw new Error('Failed to fetch skill attributes');
    }
    const data: SkillAttributesResponse = await response.json();
    return data.attributes;
  },

  updateSkillAttributes: async (groupId: number, attributesData: CreateSkillAttributeRequest[]): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills/attributes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({attributes: attributesData}),
    });
    if (!response.ok) {
      throw new Error('Failed to update skill attribute');
    }
  },

  getSkillsWithFilter: async (groupId: number, filters: Record<string, string>): Promise<GroupSkill[]> => {
    const params = new URLSearchParams(filters).toString();
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/skills?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch filtered skills');
    }
    const data: GroupSkillsResponse = await response.json();
    return data.skills;
  },
};

export const characterSkillsAPI = {
  getCharacterSkills: async (groupId: number, characterId: number): Promise<GroupSkill[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/skills`);
    if (!response.ok) {
      throw new Error('Failed to fetch character skills');
    }
    const data: GroupSkillsResponse = await response.json();
    return data.skills;
  },

  addSkillToCharacter: async (groupId: number, characterId: number, skillId: number): Promise<GroupSkill> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/skills/${skillId}`, {
      method: 'PUT',
    });
    if (!response.ok) {
      throw new Error('Failed to add skill to character');
    }
    return response.json();
  },

  removeSkillFromCharacter: async (groupId: number, characterId: number, skillId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/skills/${skillId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to remove skill from character');
    }
  },
};

export const uploadAPI = {
  uploadImage: async (file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await makeAuthenticatedRequest('/upload', {
      method: 'POST',
      body: formData,
    },
      null
    );

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    return response.json();
  },
};

export const characterEquipmentAPI = {
  getEquipment: async (groupId: number, characterId: number): Promise<number[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/equipment`);
    if (!response.ok) throw new Error('Failed to fetch equipment');
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.items ?? []);
  },

  equipItem: async (groupId: number, characterId: number, itemId: number): Promise<void> => {
    await characterCommandsAPI.executeCommand(groupId, characterId, { type: 'EquipItem', payload: { itemId } });
  },

  unequipItem: async (groupId: number, characterId: number, itemId: number): Promise<void> => {
    await characterCommandsAPI.executeCommand(groupId, characterId, { type: 'UnequipItem', payload: { itemId } });
  },

  putEquipment: async (groupId: number, characterId: number, itemIds: number[]): Promise<number[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/equipment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds }),
    });
    if (!response.ok) throw new Error('Failed to update equipment order');
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.items ?? []);
  },
};

export const characterLogAPI = {
  getLog: async (
    groupId: number,
    characterId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<ActionLogResponse> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    const endpoint = `/groups/${groupId}/characters/${characterId}/log${qs ? `?${qs}` : ''}`;

    const response = await makeAuthenticatedRequest(endpoint);
    if (!response.ok) {
      throw new Error('Failed to fetch character action log');
    }
    return response.json();
  },
};

export const groupQuestsAPI = {
  getQuests: async (groupId: number): Promise<GroupQuest[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/quests`);
    if (!response.ok) throw new Error('Failed to fetch quests');
    const data: GroupQuestsResponse = await response.json();
    return data.quests;
  },

  getQuest: async (groupId: number, questId: number): Promise<GroupQuest> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/quests/${questId}`);
    if (!response.ok) throw new Error('Failed to fetch quest');
    return response.json();
  },

  createQuest: async (groupId: number, questData: CreateGroupQuestRequest): Promise<GroupQuest> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questData),
    });
    if (!response.ok) throw new Error('Failed to create quest');
    return response.json();
  },

  patchQuest: async (groupId: number, questId: number, questData: PatchGroupQuestRequest): Promise<{ updated: boolean }> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/quests/${questId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questData),
    });
    if (!response.ok) throw new Error('Failed to update quest');
    return response.json();
  },

  updateQuest: async (groupId: number, questId: number, questData: PatchGroupQuestRequest): Promise<GroupQuest> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/quests/${questId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questData),
    });
    if (!response.ok) throw new Error('Failed to update quest');
    return response.json();
  },

  deleteQuest: async (groupId: number, questId: number): Promise<void> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/quests/${questId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete quest');
  },
};

export const characterQuestsAPI = {
  getCharacterQuests: async (groupId: number, characterId: number): Promise<GroupQuest[]> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/quests`);
    if (!response.ok) throw new Error('Failed to fetch character quests');
    const data: GroupQuestsResponse = await response.json();
    return data.quests;
  },

  createCharacterQuest: async (groupId: number, characterId: number, questData: CreateGroupQuestRequest): Promise<GroupQuest> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questData),
    });
    if (!response.ok) throw new Error('Failed to create character quest');
    return response.json();
  },
};

export const characterCommandsAPI = {
  executeCommand: async (groupId: number, characterId: number, command: CharacterCommand): Promise<ExecuteCommandResult> => {
    const response = await makeAuthenticatedRequest(`/groups/${groupId}/characters/${characterId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      throw new Error('Failed to execute character command');
    }
    return response.json();
  },
};
