// components/Cards/SkillCard.tsx
import React, { useState, useContext } from 'react';
import { GroupSkill } from '../../../../types/groupSkills';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import cardStyles from '@tdn/shared/styles/card-item.module.css';
import ReactMarkdown from 'react-markdown';
import { DashboardSettingsContext } from '../../../../contexts/DashboardSettingsContext';

interface SkillCardProps {
  skill: GroupSkill;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  onRemoveFromDashboard?: () => void;
  onSelect?: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  onEdit,
  onDelete,
  showActions = true,
  onRemoveFromDashboard,
  onSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const dashboardCtx = useContext(DashboardSettingsContext);

  return (
    <div id={`skill-${skill.id}`} className={`${cardStyles.card} ${onSelect ? cardStyles.selectable : ''}`}>
      <div className={cardStyles.header} onClick={() => {
        if (onSelect) {
          onSelect();
        } else {
          setIsExpanded(!isExpanded);
        }
      }}>
        {onRemoveFromDashboard && (
          <button
            className={cardStyles.removeButton}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromDashboard();
            }}
            title="Убрать с главной"
          >
            ✕
          </button>
        )}
        <div className={cardStyles.titleSection}>
          <h3 className={cardStyles.name} title={skill.name}>{skill.name}</h3>
          <div className={cardStyles.attributesPreview}>
            {skill.attributes.map(attr => (
              <span key={attr.key} className={cardStyles.attributeTag}>
                {attr.name}: {attr.value}
              </span>
            ))}
          </div>
        </div>
        <button 
          className={cardStyles.expandButton}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div className={cardStyles.expandedContent}>
          <div className={cardStyles.description}>
            <ReactMarkdown>{skill.description}</ReactMarkdown>
          </div>
          
          {showActions && (
            <div className={cardStyles.actions}>
              {dashboardCtx && (
                <button
                  className={cardStyles.dashboardAction}
                  onClick={(e) => {
                    e.stopPropagation();
                    dashboardCtx.togglePinnedSkill(skill.id);
                  }}
                  title={dashboardCtx.isSkillPinned(skill.id) ? 'Убрать с главной' : 'Запомнить на главной'}
                >
                  {dashboardCtx.isSkillPinned(skill.id) ? '📌✓' : '📌'}
                </button>
              )}
              {onEdit && (
                <IconButton 
                  icon="edit" 
                  onClick={onEdit}
                  title="Редактировать"
                  size="small"
                  variant="primary"
                />
              )}
              {onDelete && (
                <IconButton 
                  icon="delete" 
                  onClick={onDelete}
                  title="Удалить"
                  size="small"
                  variant="danger"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillCard;