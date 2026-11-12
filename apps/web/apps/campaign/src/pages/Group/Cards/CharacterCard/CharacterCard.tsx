import React from 'react';
import { CharacterShort } from '../../../../types/characters';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import styles from './CharacterCard.module.css';

interface CharacterCardProps {
  character: CharacterShort;
  onSelect: () => void;
  showAction?: boolean;
  actionLabel?: string;
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onSelect,
  showAction = true,
  actionLabel = 'Выбрать'
}) => {
  return (
    <div className={styles.characterCard}>
      <h3 className={styles.characterName}>{character.name}</h3>
      <p className={styles.characterDescription}>{character.description}</p>
      
      {showAction && (
        <button 
          className={buttonStyles.button}
          onClick={onSelect}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default CharacterCard;
