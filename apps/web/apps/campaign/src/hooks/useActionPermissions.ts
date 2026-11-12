import { usePermissions } from '../contexts/PermissionsContext';

export const useActionPermissions = () => {
  const { isGroupAdmin, canEditCharacter } = usePermissions();

  const canEditGroup = isGroupAdmin;
  const canDeleteGroup = isGroupAdmin;
  const canManageGroupUsers = isGroupAdmin;
  const canCreateTemplates = isGroupAdmin;
  const canEditTemplates = isGroupAdmin;
  const canDeleteTemplates = isGroupAdmin;
  const canCreateItems = isGroupAdmin;
  const canEditItems = isGroupAdmin;
  const canDeleteItems = isGroupAdmin;
  const canCreateQuests = isGroupAdmin;
  const canEditQuests = isGroupAdmin;
  const canDeleteQuests = isGroupAdmin;

  const canEditThisCharacter = canEditCharacter || isGroupAdmin;
  const canDeleteThisCharacter = isGroupAdmin;
  const canManageCharacterUsers = isGroupAdmin;
  const canEditCharacterFields = canEditCharacter || isGroupAdmin;
  const canDeleteCharacterFields = canEditCharacter || isGroupAdmin;
  const canCreateCharacterQuests = canEditCharacter || isGroupAdmin;
  const canEditCharacterQuests = canEditCharacter || isGroupAdmin;
  const canDeleteCharacterQuests = isGroupAdmin;

  return {
    canEditGroup,
    canDeleteGroup,
    canManageGroupUsers,
    canCreateTemplates,
    canEditTemplates,
    canDeleteTemplates,
    canCreateItems,
    canEditItems,
    canDeleteItems,
    canCreateQuests,
    canEditQuests,
    canDeleteQuests,
    canEditThisCharacter,
    canDeleteThisCharacter,
    canManageCharacterUsers,
    canEditCharacterFields,
    canDeleteCharacterFields,
    canCreateCharacterQuests,
    canEditCharacterQuests,
    canDeleteCharacterQuests,
  };
};