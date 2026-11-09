import React, { useState, useEffect } from 'react';
import { CharacterField } from '../../../../../types/characters';
import styles from './FieldRow.module.css';
import DropdownMenu, { MenuItem } from '@tdn/shared/ui/DropdownMenu/DropdownMenu';
import EvaluatedInput from '@tdn/shared/ui/EvaluatedInput/EvaluatedInput';

interface FieldRowProps {
  field: CharacterField;
  fieldKey: string;
  showMenu?: boolean;
  menuItems?: MenuItem[];
  onValueChange?: (newValue: string) => void;
  editable?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, fieldKey: string) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  fieldKey,
  showMenu = false,
  menuItems = [],
  onValueChange,
  editable = false,
  draggable = false,
  onDragStart
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.value.toString());

  useEffect(() => {
    setEditValue(field.value.toString());
  }, [field.value]);

  const handleDragStart = (e: React.DragEvent) => {
    if (draggable && onDragStart) {
      onDragStart(e, fieldKey);
    }
  };

  const formatValue = (field: CharacterField) => {
    if (field.maxValue !== undefined) {
      return `${field.value} / ${field.maxValue}`;
    }
    if (field.modifier !== undefined) {
      return `${field.value} (${field.modifier > 0 ? '+' : ''}${field.modifier})`;
    }
    return field.value.toString();
  };

  const renderProgressBar = (field: CharacterField) => {
    const percentage = (field.value / field.maxValue!) * 100;
    return (
      <div className={styles.progressContainer}>
        <div 
          className={styles.progressBar}
          style={{ 
            width: `${percentage}%`,
            backgroundColor: `color-mix(in srgb, var(--progress-bar-from) ${100 - percentage}%, var(--progress-bar-to))`
          }}
        >
          <span className={styles.progressText}>
            {field.value}/{field.maxValue}
          </span>
        </div>
      </div>
    );
  };

  const renderFieldValue = () => {
    if (isEditing) {
      return (
        <EvaluatedInput
          initialValue={editValue}
          onCommit={(value) => {
            setEditValue(value);
            if (onValueChange) onValueChange(value);
            setIsEditing(false);
          }}
          onCancel={() => {
            setEditValue(field.value.toString());
            setIsEditing(false);
          }}
          className={styles.editInput}
          autoFocus
        />
      );
    }

    return (
      <div 
        className={editable ? styles.editableValue : styles.value}
        onClick={() => editable && setIsEditing(true)}
      >
        {field.maxValue !== undefined ? renderProgressBar(field) : formatValue(field) || '—'}
      </div>
    );
  };

  const renderMenuButton = () => {
    if (!showMenu || menuItems.length === 0) return null;

    return (
      <DropdownMenu
        items={menuItems}
        buttonTitle="Действия с полем"
        align="right"
        position="bottom"
      />
    );
  };

  return (
    <tr 
      className={styles.row}
      draggable={draggable}
      onDragStart={handleDragStart}
      style={{ cursor: draggable ? 'grab' : 'default' }}
    >
      <td className={styles.nameCell}>
        <div className={styles.nameContent}>
          <span className={styles.fieldName}>{field.name}</span>
          {renderMenuButton()}
        </div>
      </td>
      <td className={styles.valueCell}>
        {renderFieldValue()}
      </td>
    </tr>
  );
};

export default FieldRow;