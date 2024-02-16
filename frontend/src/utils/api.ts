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
    groups: Array<IGroup>
}

interface NotesResponse {
    notes: Array<INote>
}

const BACKEND_HOST = "https://the-dungeon-notebook.ru/api/"

export interface TokenResponse {
    access_token: string;
}

export class Api {
    static exchangeToken = async (authData: VkResponse) => {
        console.log(JSON.stringify(authData))
        const response = await fetch(BACKEND_HOST + 'auth', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(authData),
        });

        let result = await response.json();
        console.log(result);

        return result as TokenResponse;
    }

    static fetchGroups = async (token: string | null): Promise<Array<IGroup>>  => {
        console.log("fetchGroups");
        console.log(token)
        if (!token) {
            console.error('token not found');
            throw new Error('token not found');
        }

        const response = await fetch(BACKEND_HOST + 'groups', {
            method: 'GET',
            headers: {
                "token": token
            }
        });

        let result = await response.json() as GroupsResponse;
        console.log(result);
        return result.groups;
    }

    static fetchNotes = async (groupId: number, token: string | null): Promise<Array<INote>>  => {
        console.log("fetchNotes");
        console.log(token)
        if (!token) {
            console.error('token not found');
            throw new Error('token not found');
        }

        const response = await fetch(BACKEND_HOST + `groups/${groupId}/notes`, {
            method: 'GET',
            headers: {
                "token": token
            }
        });

        let result = await response.json() as NotesResponse;
        console.log(result);
        return result.notes;
    }
}
