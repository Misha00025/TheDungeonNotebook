import { VkResponse } from "./VkService";

interface Author {
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

export interface IGroup {
  id: number;
  name: string;
}

interface GroupsResponse {
  groups: Array<IGroup>;
}

interface NotesResponse {
  notes: Array<INote>;
}

// const BACKEND_HOST = "http://127.0.0.1:5000/api/"
const BACKEND_HOST = "https://the-dungeon-notebook.ru/api/";
const API_VERSION = "v1/";
const BACKEND_VERSION_HOST = BACKEND_HOST + API_VERSION;

export interface TokenResponse {
  access_token: string;
}

export class Api {
  static exchangeToken = async (authData: VkResponse) => {
    console.log(JSON.stringify(authData));
    const response = await fetch(BACKEND_HOST + "auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authData),
    });

    const result = await response.json();
    console.log(result);

    return result as TokenResponse;
  };

  static fetchGroups = async (token: string | null): Promise<Array<IGroup>> => {
    if (!token) {
      console.error("token not found");
      throw new Error("token not found");
    }

    const response = await fetch(BACKEND_HOST + "groups", {
      method: "GET",
      headers: {
        token: token,
      },
    });

    if (!response.ok) {
      throw new Error(
        JSON.stringify({ code: response.status, message: response.statusText }),
      );
    }

    const result = (await response.json()) as GroupsResponse;
    console.log(result);
    return result.groups;
  };

  static fetchNotes = async (
    groupId: number,
    token: string | null,
  ): Promise<Array<INote>> => {
    if (!token) {
      console.error("token not found");
      throw new Error("token not found");
    }

    const params = new URLSearchParams({
      group_id: groupId.toString(),
    }).toString();
    const response = await fetch(BACKEND_VERSION_HOST + `notes/?` + params, {
      // const response = await fetch(BACKEND_HOST + `groups/${groupId}/notes`, {
      method: "GET",
      headers: {
        token: token,
      },
    });

    const result = (await response.json()) as NotesResponse;
    console.log(result);
    return result.notes;
  };

  static updateNote = async (
    updatedNote: INote,
    token: string | null,
  ): Promise<Array<INote>> => {
    if (!token) {
      console.error("token not found");
      throw new Error("token not found");
    }

    const response = await fetch(
      BACKEND_VERSION_HOST + `notes/${updatedNote.id}`,
      {
        method: "PUT",
        headers: {
          token: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedNote),
      },
    );

    const result = (await response.json()) as NotesResponse;
    console.log(result);
    return result.notes;
  };

  static deleteNote = async (
    note: INote,
    token: string | null,
  ): Promise<Array<INote>> => {
    if (!token) {
      console.error("token not found");
      throw new Error("token not found");
    }
    console.log("delete note" + note.id);

    const response = await fetch(BACKEND_VERSION_HOST + `notes/${note.id}`, {
      method: "DELETE",
      headers: {
        token: token,
        "Content-Type": "application/json",
      },
    });

    console.log("delete result" + response);

    const result = (await response.json()) as NotesResponse;
    console.log(result);
    return result.notes;
  };
}
