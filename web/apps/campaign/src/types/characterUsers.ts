import { User } from './groupUsers';

export interface CharacterUser {
  canWrite: boolean;
  user: User;
}

export interface CharacterUsersResponse {
  users: CharacterUser[];
}