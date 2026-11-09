export interface Group<T> {
  id: string;
  name: string;
  items: T[];
  children: Group<T>[];
}

/**
 * Группирует элементы по нескольким атрибутам в указанном порядке
 * @param items Массив элементов
 * @param attributeNames Список атрибутов для иерархической группировки
 */
export function groupByAttributes<T extends { 
  attributes?: Array<{ name: string; value: string }> 
}>(
  items: T[], 
  attributeNames: string[]
): Group<T>[] {
  if (attributeNames.length === 0 || items.length === 0) {
    return [{
      id: 'all',
      name: 'Все элементы',
      items,
      children: []
    }];
  }
  
  // Рекурсивная функция для создания групп
  const createGroups = (
    currentItems: T[], 
    remainingAttrs: string[], 
    level: number = 0,
    parentId: string = ''
  ): Group<T>[] => {
    if (remainingAttrs.length === 0) {
      return [];
    }
    
    const currentAttr = remainingAttrs[0];
    const nextAttrs = remainingAttrs.slice(1);
    const groupsMap = new Map<string, T[]>();
    
    // Группируем по текущему атрибуту
    currentItems.forEach(item => {
      const attribute = item.attributes?.find(attr => attr.name === currentAttr);
      const groupName = `${currentAttr}: ` + (attribute?.value || `Не задано`);
      
      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
      }
      groupsMap.get(groupName)!.push(item);
    });
    
    // Создаем группы для текущего уровня
    const groups: Group<T>[] = [];
    groupsMap.forEach((groupItems, groupName) => {
      const groupId = `${parentId}${currentAttr}-${groupName}`;
      
      // Если есть следующие атрибуты, создаем подгруппы
      if (nextAttrs.length > 0) {
        const children = createGroups(groupItems, nextAttrs, level + 1, `${groupId}/`);
        
        groups.push({
          id: groupId,
          name: groupName,
          items: [], // На промежуточных уровнях элементы не храним, только в последнем
          children
        });
      } else {
        // Это последний уровень, храним элементы здесь
        groups.push({
          id: groupId,
          name: groupName,
          items: groupItems,
          children: []
        });
      }
    });

    return groups.sort((a, b) => {
      if (a.name.endsWith('Не задано')) return 1;
      if (b.name.endsWith('Не задано')) return -1;
      
      // Извлекаем значение из строки формата "Атрибут: значение"
      const extractValue = (fullName: string): string => {
        const parts = fullName.split(': ');
        return parts.length > 1 ? parts[1] : fullName;
      };
      
      const aValue = extractValue(a.name);
      const bValue = extractValue(b.name);
      
      // Функция для проверки, является ли строка целым числом
      const isIntegerString = (str: string): boolean => {
        const trimmed = str.trim();
        if (trimmed === '' || trimmed === '-') return false;
        return /^-?(0|[1-9]\d*)$/.test(trimmed);
      };
      
      // Если обе значения являются целыми числами, сравниваем их как числа
      if (isIntegerString(aValue) && isIntegerString(bValue)) {
        const aNum = parseInt(aValue.trim(), 10);
        const bNum = parseInt(bValue.trim(), 10);
        return aNum - bNum;
      }
      
      // Иначе используем обычное строковое сравнение
      return a.name.localeCompare(b.name);
    });
  };
  
  return createGroups(items, attributeNames);
}