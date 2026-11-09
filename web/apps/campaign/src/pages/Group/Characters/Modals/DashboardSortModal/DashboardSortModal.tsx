import React, { useState } from 'react';
import { Character } from '../../../../../types/characters';
import { CharacterItem } from '../../../../../types/characterItems';
import { CharacterSkill } from '../../../../../types/characterSkills';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import { useDashboardSettingsContext } from '../../../../../contexts/DashboardSettingsContext';
import styles from './DashboardSortModal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';

interface DashboardSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  characterId: number;
  character: Character | null;
  items: CharacterItem[];
  skills: CharacterSkill[];
}

const DashboardSortModal: React.FC<DashboardSortModalProps> = ({
  isOpen,
  onClose,
  groupId,
  characterId,
  character,
  items,
  skills,
}) => {
  const { settings, toggleField, toggleItem, toggleEquipped, togglePinnedSkill, saveEquippedOrder } = useDashboardSettingsContext();

  const [orderedFields, setOrderedFields] = useState<string[]>([...settings.fields]);
  const [orderedItems, setOrderedItems] = useState<number[]>([...settings.items]);
  const [orderedEquipped, setOrderedEquipped] = useState<number[]>([...settings.equipped]);
  const [orderedPinned, setOrderedPinned] = useState<number[]>([...settings.pinnedSkills]);

  const [dragFieldIndex, setDragFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null);

  const moveInArray = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const handleDragStart = (index: number, setDrag: (idx: number | null) => void) => (e: React.DragEvent) => {
    setDrag(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number, setDragOver: (idx: number | null) => void) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(index);
  };

  const handleDragLeave = (setDragOver: (idx: number | null) => void) => () => {
    setDragOver(null);
  };

  const handleDrop = (
    dropIndex: number,
    dragIndex: number | null,
    ordered: any[],
    setOrdered: (arr: any[]) => void,
    setDrag: (idx: number | null) => void,
    setDragOver: (idx: number | null) => void,
  ) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDrag(null);
      setDragOver(null);
      return;
    }
    setOrdered(moveInArray(ordered, dragIndex, dropIndex));
    setDrag(null);
    setDragOver(null);
  };

  const handleSave = async () => {
    const newSettings = {
      fields: orderedFields,
      items: orderedItems,
      equipped: orderedEquipped,
      pinnedSkills: orderedPinned,
    };
    localStorage.setItem(`character_dashboard_${groupId}_${characterId}`, JSON.stringify(newSettings));
    await saveEquippedOrder(orderedEquipped);
    onClose();
  };

  const itemMap = new Map(items.map(i => [i.id, i]));
  const skillMap = new Map(skills.map(s => [s.id, s]));

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <h2>Настройка главной страницы</h2>
      <div className={modalStyles.modalBody}>
      <p className={styles.hint}>Перетаскивайте или используйте кнопки ▲▼ для сортировки. ✕ — убрать с главной.</p>

      {orderedFields.length > 0 && (
        <div className={modalStyles.formGroup}>
          <h3 className={styles.sectionTitle}>Поля</h3>
          <div className={styles.list}>
            {orderedFields.map((fieldKey, index) => {
              const field = character?.fields[fieldKey];
              if (!field) return null;
              return (
                <div
                  key={fieldKey}
                  className={`${styles.item} ${dragFieldIndex === index ? styles.dragging : ''} ${dragOverFieldIndex === index ? styles.dragOver : ''}`}
                  draggable
                  onDragStart={handleDragStart(index, setDragFieldIndex)}
                  onDragOver={handleDragOver(index, setDragOverFieldIndex)}
                  onDragLeave={handleDragLeave(setDragOverFieldIndex)}
                  onDrop={handleDrop(index, dragFieldIndex, orderedFields, setOrderedFields, setDragFieldIndex, setDragOverFieldIndex)}
                  onDragEnd={() => { setDragFieldIndex(null); setDragOverFieldIndex(null); }}
                >
                  <span className={styles.dragHandle}>⠿</span>
                  <span className={styles.itemName}>{field.name}</span>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.moveBtn}
                      disabled={index === 0}
                      onClick={() => setOrderedFields(moveInArray(orderedFields, index, index - 1))}
                    >▲</button>
                    <button
                      className={styles.moveBtn}
                      disabled={index === orderedFields.length - 1}
                      onClick={() => setOrderedFields(moveInArray(orderedFields, index, index + 1))}
                    >▼</button>
                    <button
                      className={styles.removeBtn}
                      onClick={() => {
                        toggleField(fieldKey);
                        setOrderedFields(prev => prev.filter(k => k !== fieldKey));
                      }}
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orderedItems.length > 0 && (
        <div className={modalStyles.formGroup}>
          <h3 className={styles.sectionTitle}>Предметы (ресурсы)</h3>
          <div className={styles.list}>
            {orderedItems.map((itemId, index) => {
              const item = itemMap.get(itemId);
              if (!item) return null;
              return (
                <div key={itemId} className={styles.item}>
                  <span className={styles.dragHandle}>⠿</span>
                  <span className={styles.itemName}>{item.name}</span>
                  <div className={styles.itemActions}>
                    <button className={styles.moveBtn} disabled={index === 0}
                      onClick={() => setOrderedItems(moveInArray(orderedItems, index, index - 1))}
                    >▲</button>
                    <button className={styles.moveBtn} disabled={index === orderedItems.length - 1}
                      onClick={() => setOrderedItems(moveInArray(orderedItems, index, index + 1))}
                    >▼</button>
                    <button className={styles.removeBtn}
                      onClick={() => {
                        toggleItem(itemId);
                        setOrderedItems(prev => prev.filter(id => id !== itemId));
                      }}
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orderedEquipped.length > 0 && (
        <div className={modalStyles.formGroup}>
          <h3 className={styles.sectionTitle}>Экипировка</h3>
          <div className={styles.list}>
            {orderedEquipped.map((itemId, index) => {
              const item = itemMap.get(itemId);
              if (!item) return null;
              return (
                <div key={itemId} className={styles.item}>
                  <span className={styles.dragHandle}>⠿</span>
                  <span className={styles.itemName}>{item.name}</span>
                  <div className={styles.itemActions}>
                    <button className={styles.moveBtn} disabled={index === 0}
                      onClick={() => setOrderedEquipped(moveInArray(orderedEquipped, index, index - 1))}
                    >▲</button>
                    <button className={styles.moveBtn} disabled={index === orderedEquipped.length - 1}
                      onClick={() => setOrderedEquipped(moveInArray(orderedEquipped, index, index + 1))}
                    >▼</button>
                    <button className={styles.removeBtn}
                      onClick={() => {
                        toggleEquipped(itemId);
                        setOrderedEquipped(prev => prev.filter(id => id !== itemId));
                      }}
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orderedPinned.length > 0 && (
        <div className={modalStyles.formGroup}>
          <h3 className={styles.sectionTitle}>Способности</h3>
          <div className={styles.list}>
            {orderedPinned.map((skillId, index) => {
              const skill = skillMap.get(skillId);
              if (!skill) return null;
              return (
                <div key={skillId} className={styles.item}>
                  <span className={styles.dragHandle}>⠿</span>
                  <span className={styles.itemName}>{skill.name}</span>
                  <div className={styles.itemActions}>
                    <button className={styles.moveBtn} disabled={index === 0}
                      onClick={() => setOrderedPinned(moveInArray(orderedPinned, index, index - 1))}
                    >▲</button>
                    <button className={styles.moveBtn} disabled={index === orderedPinned.length - 1}
                      onClick={() => setOrderedPinned(moveInArray(orderedPinned, index, index + 1))}
                    >▼</button>
                    <button className={styles.removeBtn}
                      onClick={() => {
                        togglePinnedSkill(skillId);
                        setOrderedPinned(prev => prev.filter(id => id !== skillId));
                      }}
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orderedFields.length === 0 && orderedItems.length === 0 && orderedEquipped.length === 0 && orderedPinned.length === 0 && (
        <p className={styles.empty}>Главная страница пуста. Добавьте элементы на вкладках Статы, Инвентарь или Способности.</p>
      )}

      </div>
      <div className={modalStyles.buttons}>
        <button className={buttonStyles.button} onClick={handleSave}>Готово</button>
      </div>
    </ModalPortal>
  );
};

export default DashboardSortModal;
