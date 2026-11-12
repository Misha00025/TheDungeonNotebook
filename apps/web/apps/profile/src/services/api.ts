// src/services/api.ts
// API-клиенты профиля.
//
// Общие (auth/user/settings) клиенты и makeAuthenticatedRequest переехали
// в @tdn/shared. Здесь — только доменный клиент загрузки изображений
// (uploadAPI), который использует makeAuthenticatedRequest из shared.

import { makeAuthenticatedRequest } from '@tdn/shared';

export const uploadAPI = {
  uploadImage: async (file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await makeAuthenticatedRequest(
      '/upload',
      {
        method: 'POST',
        body: formData,
      },
      null
    );

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    return response.json();
  },
};
