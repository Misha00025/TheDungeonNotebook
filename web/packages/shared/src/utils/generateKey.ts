export const generateKey = (fieldName: string): string => {
    return fieldName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-zа-я0-9_]/g, '');
  };