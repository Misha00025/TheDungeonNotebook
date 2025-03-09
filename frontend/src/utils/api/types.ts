// API Types

export interface Author {
  photo: string;
  first_name: string;
  last_name: string;
}

export interface INote {
  id: number;
  header: string;
  body: string;
  author: Author;
}

export interface IItem {
  id: number;
  name: string;
  amount?: number;
  description: string;
  icon: string;
}

export interface IGroup {
  id: number;
  name: string;
}

export interface GroupsResponse {
  groups: Array<IGroup>;
}

export interface NotesResponse {
  notes: Array<INote>;
}

export interface ItemsResponse {
  items: Array<IItem>;
}

export interface TokenResponse {
  access_token: string;
}

export interface ApiError {
  code: number;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
