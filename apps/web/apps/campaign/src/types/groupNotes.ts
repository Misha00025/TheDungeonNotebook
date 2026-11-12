export interface GroupNote {
  id: number;
  header: string;
  short_description: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  group_id: number;
  character_id: number | null;
  keywords: string[];
}

export interface CreateGroupNoteRequest {
  header: string;
  short_description: string;
  body?: string;
  keywords?: string[];
}

export interface UpdateGroupNoteRequest extends CreateGroupNoteRequest {}
