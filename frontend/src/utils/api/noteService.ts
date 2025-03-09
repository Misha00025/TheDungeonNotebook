import { API_VERSIONS, ENDPOINTS } from "./config";
import { httpClient } from "./httpClient";
import { INote, NotesResponse } from "./types";

/**
 * Service for handling note-related API calls
 */
export class NoteService {
  /**
   * Fetch notes for a specific group
   * @param groupId Group ID
   * @returns Array of notes
   */
  static async fetchNotes(groupId: number): Promise<INote[]> {
    const response = await httpClient.get<NotesResponse>(
      `${API_VERSIONS.V1}${ENDPOINTS.NOTES}`,
      { group_id: groupId.toString() },
    );

    if (response.error) {
      console.error("Error fetching notes:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.notes) {
      return [];
    }

    return response.data.notes;
  }

  /**
   * Create a new note
   * @param groupId Group ID
   * @param header Note header
   * @param body Note body
   * @returns The created note
   */
  static async createNote(
    groupId: number,
    header: string,
    body: string,
  ): Promise<INote> {
    const response = await httpClient.post<{ note: INote }>(
      `${API_VERSIONS.V1}${ENDPOINTS.NOTES}`,
      {
        group_id: groupId,
        header,
        body,
      },
    );

    if (response.error) {
      console.error("Error creating note:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.note) {
      throw new Error("Failed to create note");
    }

    return response.data.note;
  }

  /**
   * Update a note
   * @param note Note to update
   * @returns The updated note
   */
  static async updateNote(note: INote): Promise<INote> {
    const response = await httpClient.put<{ note: INote }>(
      `${API_VERSIONS.V1}${ENDPOINTS.NOTES}/${note.id}`,
      note,
    );

    if (response.error) {
      console.error("Error updating note:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.note) {
      throw new Error("Failed to update note");
    }

    return response.data.note;
  }

  /**
   * Delete a note
   * @param noteId Note ID
   * @returns Array of remaining notes
   */
  static async deleteNote(noteId: number): Promise<INote[]> {
    const response = await httpClient.delete<NotesResponse>(
      `${API_VERSIONS.V1}${ENDPOINTS.NOTES}/${noteId}`,
    );

    if (response.error) {
      console.error("Error deleting note:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.notes) {
      return [];
    }

    return response.data.notes;
  }

  /**
   * Get a specific note
   * @param noteId Note ID
   * @returns The note
   */
  static async getNote(noteId: number): Promise<INote> {
    const response = await httpClient.get<{ note: INote }>(
      `${API_VERSIONS.V1}${ENDPOINTS.NOTES}/${noteId}`,
    );

    if (response.error) {
      console.error("Error fetching note:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.note) {
      throw new Error("Note not found");
    }

    return response.data.note;
  }
}
