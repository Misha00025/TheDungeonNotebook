import { GroupSkill, SkillAttributeDefinition, SkillGroup } from "../types/groupSkills";

export const groupSkillsByAttributes = (skills: GroupSkill[], attributes: SkillAttributeDefinition[]): SkillGroup[] => {
    if (!skills.length || !attributes.length) return [];

    const filteredAttributes = attributes.filter(attr => attr.isFiltered);
    
    if (!filteredAttributes.length) {
      return [{
        name: 'Все навыки',
        attributeKey: '',
        skills: skills,
        children: []
      }];
    }

    const createGroups = (
      currentSkills: GroupSkill[], 
      attrs: SkillAttributeDefinition[], 
      level: number = 0
    ): SkillGroup[] => {
      if (level >= attrs.length || !currentSkills.length) {
        return [];
      }

      const currentAttr = attrs[level];
      const groupsMap = new Map<string, GroupSkill[]>();
      currentSkills.forEach(skill => {
        const attribute = skill.attributes.find(attr => attr.key === currentAttr.key);
        const value = attribute?.value || 'Другое';
        
        if (!groupsMap.has(value)) {
          groupsMap.set(value, []);
        }
        groupsMap.get(value)!.push(skill);
      });

      const groups: SkillGroup[] = [];
      groupsMap.forEach((groupSkills, value) => {
        const groupName = value === 'Другое' ? 'Другое' :currentAttr.name + ": " + value;
        
        groups.push({
          name: groupName,
          attributeKey: currentAttr.key,
          skills: level === attrs.length - 1 ? groupSkills : [],
          children: level < attrs.length - 1 ? 
                   createGroups(groupSkills, attrs, level + 1) : []
        });
      });

      return groups.sort((a, b) => {
        if (a.name === 'Другое') return 1;
        if (b.name === 'Другое') return -1;
        return a.name.localeCompare(b.name);
      });
    };

    return createGroups(skills, filteredAttributes);
  };

