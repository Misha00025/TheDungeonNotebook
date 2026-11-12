import React, { useState, useEffect } from 'react';
import { CharacterItem, CreateCharacterItemRequest, UpdateCharacterItemRequest } from '../../../../types/characterItems';
import { GroupItem } from '../../../../types/groupItems';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import ModalPortal from '@tdn/shared/ui/ModalPortal/ModalPortal';
import uiStyles from '@tdn/shared/styles/ui.module.css';
import EvaluatedInput from '@tdn/shared/ui/EvaluatedInput/EvaluatedInput';
import SearchBar from '@tdn/shared/ui/Search/SearchBar';
import ItemCard from '../../Cards/ItemCard/ItemCard';

interface CharacterItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: CreateCharacterItemRequest | UpdateCharacterItemRequest) => Promise<void>;
  editingItem?: CharacterItem | null;
  title: string;
  groupItems: GroupItem[];
}

type Step = 'select' | 'details';

const CharacterItemModal: React.FC<CharacterItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  title,
  groupItems
}) => {
  const [step, setStep] = useState<Step>('select');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>(1);
  const [price, setPrice] = useState<number | ''>(0);
  const [imageLink, setImageLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState<'new' | 'existing'>('existing');
  const [selectedGroupItem, setSelectedGroupItem] = useState<GroupItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState<GroupItem[]>([]);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description);
      setAmount(editingItem.amount);
      setPrice(editingItem.price);
      setImageLink(editingItem.image_link || '');
      setCreationMode('existing');
      setStep('details');
    } else {
      setName('');
      setDescription('');
      setAmount(1);
      setPrice(0);
      setImageLink('');
      setCreationMode('existing');
      setSelectedGroupItem(null);
      setSearchTerm('');
      setStep('select');
    }
  }, [editingItem, isOpen]);

  useEffect(() => {
    if (!isOpen || creationMode !== 'existing' || editingItem) return;

    let result = groupItems;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.attributes?.some(attr => 
          attr.name.toLowerCase().includes(term) ||
          attr.value.toLowerCase().includes(term)
        )
      );
    }

    setFilteredItems(result);
  }, [groupItems, searchTerm, isOpen, creationMode, editingItem]);

  const handleSelectItem = (item: GroupItem) => {
    setSelectedGroupItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price);
    setImageLink(item.image_link || '');
    setStep('details');
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedGroupItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const itemData = {
        id: selectedGroupItem?.id ?? 0,
        name,
        description,
        amount: amount === '' ? 1 : amount < 0 ? 0 : amount,
        price: price === '' ? 0 : price,
        image_link: imageLink || undefined,
      };

      await onSave(itemData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <h2>{title}</h2>
      <div className={modalStyles.topPanel}>
        {!editingItem && (
          <div className={modalStyles.formGroup}>
            <label>Способ добавления:</label>
            <div className={uiStyles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="new"
                  checked={creationMode === 'new'}
                  onChange={() => {
                    setCreationMode('new');
                    setSelectedGroupItem(null);
                    setName('');
                    setDescription('');
                    setPrice(0);
                    setImageLink('');
                    setStep('details');
                  }}
                />
                Создать новый
              </label>
              <label>
                <input
                  type="radio"
                  value="existing"
                  checked={creationMode === 'existing'}
                  onChange={() => {
                    setCreationMode('existing');
                    setStep('select');
                  }}
                />
                Добавить готовый
              </label>
            </div>
          </div>
        )}
        {creationMode === 'existing' && step === 'select' && !editingItem && (
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Поиск предмета..."
            showClearButton={false}
          />
        )}
      </div>
      <div className={modalStyles.modalBody}>
        {error && <div className={modalStyles.error}>{error}</div>}

        {creationMode === 'existing' && step === 'select' && !editingItem && (
          <>
            {filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={() => handleSelectItem(item)}
                showActions={false}
              />
            ))}
            {filteredItems.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                Нет доступных предметов
              </p>
            )}
          </>
        )}

        {creationMode === 'existing' && step === 'details' && selectedGroupItem && (
          <ItemCard item={selectedGroupItem} showActions={false} />
        )}

        {creationMode === 'new' && (
          <form id="new-item-form" onSubmit={handleSubmit}>
            <div className={modalStyles.formGroup}>
              <label>Название:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputStyles.input}
                required
              />
            </div>
            <div className={modalStyles.formGroup}>
              <label>Описание:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputStyles.input}
                rows={3}
                required
              />
            </div>
            <div className={modalStyles.formGroup}>
              <label>Цена:</label>
              <EvaluatedInput
                initialValue={price === '' ? '' : price.toString()}
                onCommit={(value) => setPrice(value.trim() === '' ? 0 : Math.max(0, Number(value.trim())))}
                className={inputStyles.input}
                placeholder="Цена за единицу"
                required
              />
            </div>
            <div className={modalStyles.formGroup}>
              <label>Количество:</label>
              <EvaluatedInput
                initialValue={amount === '' ? '' : amount.toString()}
                onCommit={(value) => setAmount(value.trim() === '' ? 1 : Math.max(0, Number(value.trim())))}
                className={inputStyles.input}
                placeholder="Количество"
                required
              />
            </div>
          </form>
        )}

        {editingItem && selectedGroupItem && (
          <ItemCard item={selectedGroupItem} showActions={false} />
        )}

        {editingItem && (
          <div className={modalStyles.formGroup} style={{ marginTop: '1rem' }}>
            <label>Количество:</label>
            <EvaluatedInput
              initialValue={amount === '' ? '' : amount.toString()}
              onCommit={(value) => setAmount(value.trim() === '' ? 1 : Math.max(0, Number(value.trim())))}
              className={inputStyles.input}
              placeholder="Количество"
              required
            />
          </div>
        )}

      </div>
      <div className={modalStyles.buttons}>
        {creationMode === 'existing' && step === 'select' && !editingItem && (
          <button type="button" onClick={onClose} className={buttonStyles.button}>
            Отмена
          </button>
        )}
        {creationMode === 'existing' && step === 'details' && !editingItem && (
          <>
            <button type="button" onClick={handleBackToSelect} className={buttonStyles.button}>
              ← Назад
            </button>
            <div className={modalStyles.formGroup} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <label style={{ whiteSpace: 'nowrap', margin: 0 }}>Количество:</label>
              <span style={{ width: '80px' }}>
              <EvaluatedInput
                initialValue={amount === '' ? '' : amount.toString()}
                onCommit={(value) => setAmount(value.trim() === '' ? 1 : Math.max(0, Number(value.trim())))}
                className={inputStyles.input}
                placeholder="Количество"
                required
              />
              </span>
            </div>
            <button
              type="button"
              className={buttonStyles.button}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        )}
        {creationMode === 'new' && (
          <>
            <button type="button" onClick={onClose} className={buttonStyles.button}>
              Отмена
            </button>
            <button type="submit" form="new-item-form" className={buttonStyles.button} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        )}
        {editingItem && (
          <>
            <button type="button" onClick={onClose} className={buttonStyles.button}>
              Отмена
            </button>
            <button type="button" className={buttonStyles.button} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        )}
      </div>
    </ModalPortal>
  );
};

export default CharacterItemModal;
