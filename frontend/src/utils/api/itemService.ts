import { API_VERSIONS, ENDPOINTS } from "./config";
import { httpClient } from "./httpClient";
import { IItem, ItemsResponse } from "./types";

/**
 * Service for handling item-related API calls
 */
export class ItemService {
  /**
   * Fetch items for a specific group
   * @param groupId Group ID
   * @returns Array of items
   */
  static async fetchItems(groupId: number): Promise<IItem[]> {
    const response = await httpClient.get<ItemsResponse>(
      `${API_VERSIONS.V1}${ENDPOINTS.ITEMS}`,
      { group_id: groupId.toString() },
    );

    if (response.error) {
      console.error("Error fetching items:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.items) {
      return [];
    }

    return response.data.items;
  }

  /**
   * Create a new item
   * @param groupId Group ID
   * @param name Item name
   * @param description Item description
   * @param icon Item icon URL
   * @param amount Item quantity
   * @returns The created item
   */
  static async createItem(
    groupId: number,
    name: string,
    description: string,
    icon = "",
    amount = 1,
  ): Promise<IItem> {
    const response = await httpClient.post<{ item: IItem }>(
      `${API_VERSIONS.V1}${ENDPOINTS.ITEMS}`,
      {
        group_id: groupId,
        name,
        description,
        icon,
        amount,
      },
    );

    if (response.error) {
      console.error("Error creating item:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.item) {
      throw new Error("Failed to create item");
    }

    return response.data.item;
  }

  /**
   * Update an item
   * @param item Item to update
   * @returns The updated item
   */
  static async updateItem(item: IItem): Promise<IItem> {
    const response = await httpClient.put<{ item: IItem }>(
      `${API_VERSIONS.V1}${ENDPOINTS.ITEMS}/${item.id}`,
      item,
    );

    if (response.error) {
      console.error("Error updating item:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.item) {
      throw new Error("Failed to update item");
    }

    return response.data.item;
  }

  /**
   * Delete an item
   * @param itemId Item ID
   * @returns Array of remaining items
   */
  static async deleteItem(itemId: number): Promise<IItem[]> {
    const response = await httpClient.delete<ItemsResponse>(
      `${API_VERSIONS.V1}${ENDPOINTS.ITEMS}/${itemId}`,
    );

    if (response.error) {
      console.error("Error deleting item:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.items) {
      return [];
    }

    return response.data.items;
  }

  /**
   * Get a specific item
   * @param itemId Item ID
   * @returns The item
   */
  static async getItem(itemId: number): Promise<IItem> {
    const response = await httpClient.get<{ item: IItem }>(
      `${API_VERSIONS.V1}${ENDPOINTS.ITEMS}/${itemId}`,
    );

    if (response.error) {
      console.error("Error fetching item:", response.error);
      throw new Error(response.error.message);
    }

    if (!response.data?.item) {
      throw new Error("Item not found");
    }

    return response.data.item;
  }
}
