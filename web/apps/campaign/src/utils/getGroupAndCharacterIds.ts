// utils/getGroupAndCharacterIds.ts
// Доменная утилита кампании: парсит group/character из URL.
// Перенесена из @tdn/shared (shared = только инфраструктура, ноль домена).

export interface GroupCharacterIds {
  groupId?: number;
  characterId?: number;
}

export const getGroupAndCharacterIds = (pathname: string): GroupCharacterIds => {
  const pathParts = pathname.split('/').filter(part => part !== '');

  let groupId: number | undefined;
  let characterId: number | undefined;

  const groupIndex = pathParts.indexOf('groups');
  if (groupIndex !== -1 && pathParts.length > groupIndex + 1) {
    const parsed = parseInt(pathParts[groupIndex + 1], 10);
    if (!isNaN(parsed)) {
      groupId = parsed;
    }
  }

  const characterIndex = pathParts.indexOf('character');
  if (characterIndex !== -1 && pathParts.length > characterIndex + 1) {
    const parsed = parseInt(pathParts[characterIndex + 1], 10);
    if (!isNaN(parsed)) {
      characterId = parsed;
    }
  }

  return { groupId, characterId };
};
