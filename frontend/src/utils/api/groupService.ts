import { API_VERSIONS, ENDPOINTS } from "./config";
import { httpClient } from "./httpClient";
import { GroupsResponse, IGroup } from "./types";

/**
 * Service for handling group-related API calls
 */
export class GroupService {
  /**
   * Fetch all groups for the current user
   * @returns Array of groups
   */
  static async fetchGroups(): Promise<IGroup[]> {
    const response = await httpClient.get<GroupsResponse>(ENDPOINTS.GROUPS);

    if (response.error) {
      console.error("Error fetching groups:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.groups) {
      return [];
    }

    return response.data.groups;
  }

  /**
   * Create a new group
   * @param name Group name
   * @returns The created group
   */
  static async createGroup(name: string): Promise<IGroup> {
    const response = await httpClient.post<{ group: IGroup }>(
      ENDPOINTS.GROUPS,
      { name },
    );

    if (response.error) {
      console.error("Error creating group:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.group) {
      throw new Error("Failed to create group");
    }

    return response.data.group;
  }

  /**
   * Update a group
   * @param groupId Group ID
   * @param name New group name
   * @returns The updated group
   */
  static async updateGroup(groupId: number, name: string): Promise<IGroup> {
    const response = await httpClient.put<{ group: IGroup }>(
      `${ENDPOINTS.GROUPS}/${groupId}`,
      { name },
    );

    if (response.error) {
      console.error("Error updating group:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.group) {
      throw new Error("Failed to update group");
    }

    return response.data.group;
  }

  /**
   * Delete a group
   * @param groupId Group ID
   * @returns Success status
   */
  static async deleteGroup(groupId: number): Promise<boolean> {
    const response = await httpClient.delete<{ success: boolean }>(
      `${ENDPOINTS.GROUPS}/${groupId}`,
    );

    if (response.error) {
      console.error("Error deleting group:", response.error);
      throw new Error(response.error.message);
    }

    return response.data?.success || false;
  }

  /**
   * Join a group
   * @param groupId Group ID
   * @returns The joined group
   */
  static async joinGroup(groupId: number): Promise<IGroup> {
    const response = await httpClient.post<{ group: IGroup }>(
      `${ENDPOINTS.GROUPS}/${groupId}/join`,
    );

    if (response.error) {
      console.error("Error joining group:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.group) {
      throw new Error("Failed to join group");
    }

    return response.data.group;
  }

  /**
   * Leave a group
   * @param groupId Group ID
   * @returns Success status
   */
  static async leaveGroup(groupId: number): Promise<boolean> {
    const response = await httpClient.post<{ success: boolean }>(
      `${ENDPOINTS.GROUPS}/${groupId}/leave`,
    );

    if (response.error) {
      console.error("Error leaving group:", response.error);
      throw new Error(response.error.message);
    }

    return response.data?.success || false;
  }
}
