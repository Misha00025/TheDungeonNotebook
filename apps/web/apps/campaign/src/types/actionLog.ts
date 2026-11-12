export type ActionType = string;

export interface ActionLogEntry {
  timestamp: string;
  actorId: number;
  actionType: ActionType;
  details: {
    key?: string;
    itemId?: number;
    oldValue?: number;
    delta?: number;
  };
}

export interface ActionLogResponse {
  entries: ActionLogEntry[];
  total: number;
}
