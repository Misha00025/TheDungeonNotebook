export interface User {
    id: number;
    imageLink: string | null;
    nickname: string;
    visibleName: string;
  }
  
  export interface GroupUser {
    isAdmin: boolean;
    user: User;
  }
  
  export interface GroupUsersResponse {
    users: GroupUser[];
  }
  
  export interface SearchUsersResponse {
    users: User[];
  }