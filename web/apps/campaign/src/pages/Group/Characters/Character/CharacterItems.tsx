import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CharacterItem, CreateCharacterItemRequest, UpdateCharacterItemRequest } from '../../../../types/characterItems';
import { GroupItem } from '../../../../types/groupItems';
import { characterItemsAPI } from '../../../../services/api';
import { groupItemsAPI } from '../../../../services/api';
import CharacterItemModal from '../../Modals/ItemModal/CharacterItemModal';
import { useActionPermissions } from '../../../../hooks/useActionPermissions';
import ResourcePage from '../../../../components/commons/Pages/ResourcePage/ResourcePage';
import ItemCard from '../../Cards/ItemCard/ItemCard';
import { useCharacter } from '../../../../contexts/CharacterContext';
import { useGroupSchemas } from '../../../../contexts/GroupSchemasContext';

const ItemCardWrapper: React.FC<{
  item: CharacterItem;
  onEdit?: (item: CharacterItem) => void;
  onDelete?: (id: number) => void;
  showActions?: boolean;
}> = ({ item, onEdit, onDelete, showActions }) => {
  return (
    <ItemCard
      item={item}
      onEdit={onEdit ? () => onEdit(item) : undefined}
      onDelete={onDelete ? () => onDelete(item.id) : undefined}
      showActions={showActions}
      showAmount={true}
    />
  );
};

const CharacterItems: React.FC = () => {
  const { groupId, characterId } = useParams<{ groupId: string; characterId: string }>();
  const { items, setItems, refreshItems, itemsLoading } = useCharacter();
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { itemsSchema } = useGroupSchemas();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CharacterItem | null>(null);
  const { canEditThisCharacter } = useActionPermissions();

  useEffect(() => {
    if (groupId && characterId) {
      loadGroupItems();
      refreshItems();
    }
  }, [groupId, characterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGroupItems = async () => {
    try {
      const itemsData = await groupItemsAPI.getItems(parseInt(groupId!));
      setGroupItems(itemsData);
    } catch (err) {
      console.error('Failed to load group items:', err);
    }
  };

  const handleCreateItem = async (itemData: CreateCharacterItemRequest) => {
    if (itemData.id){
      await characterItemsAPI.updateCharacterItem(parseInt(groupId!), parseInt(characterId!), itemData.id, itemData)
    }
    else{
      await characterItemsAPI.createCharacterItem(parseInt(groupId!), parseInt(characterId!), itemData);
    }
    try {
      const fresh = await characterItemsAPI.getCharacterItems(parseInt(groupId!), parseInt(characterId!));
      setItems(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh items');
    }
  };

  const handleUpdateItem = async (itemData: UpdateCharacterItemRequest) => {
    if (!editingItem) return;
    await characterItemsAPI.updateCharacterItem(parseInt(groupId!), parseInt(characterId!), editingItem.id, itemData);
    try {
      const fresh = await characterItemsAPI.getCharacterItems(parseInt(groupId!), parseInt(characterId!));
      setItems(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh items');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот предмет?')) return;

    try {
      await characterItemsAPI.deleteCharacterItem(parseInt(groupId!), parseInt(characterId!), itemId);
      try {
        const fresh = await characterItemsAPI.getCharacterItems(parseInt(groupId!), parseInt(characterId!));
        setItems(fresh);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleEditItem = (item: CharacterItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const config = {
    ItemComponent: ItemCardWrapper,
    titles: {
      page: undefined,
      create: 'Добавить'
    },
    groupByAttributes: itemsSchema.groupBy,
  };

  if (itemsLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <>
      <ResourcePage
        config={config}
        items={items}
        loading={false}
        error={error}
        canCreate={canEditThisCharacter}
        canEdit={canEditThisCharacter}
        canDelete={canEditThisCharacter}
        onCreate={() => setIsModalOpen(true)}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
      />
      
      {canEditThisCharacter && (
        <CharacterItemModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={editingItem ? handleUpdateItem : handleCreateItem}
          editingItem={editingItem}
          title={editingItem ? 'Редактирование предмета' : 'Добавление предмета'}
          groupItems={groupItems}
        />
      )}
    </>
  );
};

export default CharacterItems;