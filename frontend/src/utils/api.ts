import { VkResponse } from "./VkService";

interface Author {
    photo: string;
    first_name: string;
    last_name: string;
}

interface Note {
    id: number;
    header: string;
    body: string;
    author: Author;
}

interface Group {
    id: number;
    name: string;
}

interface GroupsResponse {
    groups: Array<Group>
}

interface NotesResponse {
    notes: Array<Note>
}

const BACKEND_HOST = "http://158.160.58.174:5000/api/"

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

    static fetchGroups = async (token: string | null): Promise<Array<Group>>  => {
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

    static fetchNotes = async (token: string | null): Promise<Array<Note>>  => {
        console.log("fetchNote");
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

        let result = await response.json() as NotesResponse;
        console.log(result);
        return result.notes;
    }
}
