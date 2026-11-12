export interface Group {
    id: number;
    name: string;
    icon: string | null;
  }
  
  export interface GroupsResponse {
    groups: Group[];
  }

  export interface CreateGroupRequest {
    name: string;
    description?: string;
    icon?: string;
  }