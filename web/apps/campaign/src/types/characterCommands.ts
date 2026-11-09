import { Character } from './characters';

export type CharacterCommandType =
  | 'AddField'
  | 'UpdateField'
  | 'DeleteField'
  | 'EquipItem'
  | 'UnequipItem';

export interface AddFieldPayload {
    key: string;
    field?: {
        name?: string;
        description?: string;
        value?: number;
        maxValue?: number;
        formula?: string;
        modifierFormula?: string;
    };
}

export interface UpdateFieldPayload {
    key: string;
    field?: {
        name?: string;
        description?: string;
        value?: number;
        maxValue?: number;
        formula?: string;
        modifierFormula?: string;
    };
}

export interface DeleteFieldPayload {
    key: string;
}

export interface EquipItemPayload {
    itemId: number;
}

export interface UnequipItemPayload {
    itemId: number;
}

export type CharacterCommand =
    | { type: 'AddField'; payload: AddFieldPayload; idempotencyKey?: string }
    | { type: 'UpdateField'; payload: UpdateFieldPayload; idempotencyKey?: string }
    | { type: 'DeleteField'; payload: DeleteFieldPayload; idempotencyKey?: string }
    | { type: 'EquipItem'; payload: EquipItemPayload; idempotencyKey?: string }
    | { type: 'UnequipItem'; payload: UnequipItemPayload; idempotencyKey?: string };

export type ExecuteCommandResult = Character;
