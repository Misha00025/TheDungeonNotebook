// components/GroupSection/GroupSection.tsx
import React, { useState } from 'react';
import { GroupSkill, SkillGroup } from '../../../../types/groupSkills';
import List from '@tdn/shared/ui/List/List';
import SkillCard from './SkillCard';

interface GroupSectionProps {
  group: SkillGroup;
  level: number;
  isMobile: boolean;
  onEditSkill?: (skill: GroupSkill) => void;
  onDeleteSkill?: (skillId: number) => void;
  showActions?: boolean;
  collapse?:boolean;
}

const GroupSection: React.FC<GroupSectionProps> = ({
  group,
  level,
  isMobile,
  onEditSkill,
  onDeleteSkill,
  showActions,
  collapse = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapse);

  return (
    <div style={{ marginLeft: isMobile ? 0 : level * 20 }}>
      <div 
        style={{ 
          padding: '10px 0', 
          borderBottom: '1px solid #eee',
          fontSize: level === 0 ? '1.5em' : level === 1 ? '1.2em' : '1em',
          fontWeight: 'bold',
          marginBottom: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span style={{ 
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '0.8em'
        }}>
          ▼
        </span>
        {group.name}
      </div>

      {!isCollapsed && (
        <>
          {group.skills.length > 0 && (
            <List layout={isMobile ? "vertical" : "start-grid"} gap="medium" gridSize='large'>
              {group.skills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onEdit={showActions && onEditSkill ? () => onEditSkill(skill) : undefined}
                  onDelete={showActions && onDeleteSkill ? () => onDeleteSkill(skill.id) : undefined}
                  showActions={showActions}
                />
              ))}
            </List>
          )}

          {group.children.map((childGroup, index) => (
            <GroupSection
              key={index}
              group={childGroup}
              level={level + 1}
              isMobile={isMobile}
              onEditSkill={onEditSkill}
              onDeleteSkill={onDeleteSkill}
              showActions={showActions}
              collapse={false}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default GroupSection;