// GroupItems.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GroupItem } from '../../types/groupItems';
import { groupItemsAPI, groupAPI } from '../../services/api';
import { useGroupSchemas } from '../../contexts/GroupSchemasContext';
import GroupItemModal from './Modals/ItemModal/GroupItemModal';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import ResourcePage from '../../components/commons/Pages/ResourcePage/ResourcePage';
import SchemaModal from './Modals/ShcemaModal/SchemaModal';
import ItemCard from './Cards/ItemCard/ItemCard';

const ItemCardWrapper: React.FC<{
  item: GroupItem;
  onEdit?: (item: GroupItem) => void;
  onDelete?: (id: number) => void;
  showActions?: boolean;
}> = ({ item, onEdit, onDelete, showActions }) => {
  return (
    <ItemCard
      item={item}
      onEdit={onEdit ? () => onEdit(item) : undefined}
      onDelete={onDelete ? () => onDelete(item.id) : undefined}
      showActions={showActions}
    />
  );
};

const GroupItems: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [items, setItems] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GroupItem | null>(null);
  const { itemsSchema, refreshSchemas } = useGroupSchemas();
  const { canEditItems, canEditGroup } = useActionPermissions();
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  
  useEffect(() => {
    if (groupId) {
      loadItems();
    }
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const loadItems = async () => {
    try {
      setLoading(true);
      const itemsData = await groupItemsAPI.getItems(parseInt(groupId!));
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (item: GroupItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };
  
  const handleDelete = async (itemId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот предмет?')) return;
    
    try {
      await groupItemsAPI.deleteItem(parseInt(groupId!), itemId);
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };
  
  const handleSaveItem = async (itemData: any) => {
    if (editingItem) {
      await groupItemsAPI.updateItem(parseInt(groupId!), editingItem.id, itemData);
    } else {
      await groupItemsAPI.createItem(parseInt(groupId!), itemData);
    }
    
    setIsModalOpen(false);
    setEditingItem(null);
    loadItems();
  };

  const handleConfigureSchema = () => {
    setIsSchemaModalOpen(true);
  };
  
  const handleSaveSchema = async (newSchema: string[]) => {
    try {
      await groupAPI.updateItemsSchema(parseInt(groupId!), newSchema);
      await refreshSchemas();
      setIsSchemaModalOpen(false);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save schema');
    }
  };

  const availableAttributes = Array.from(
    new Set(
      items.flatMap(item => 
        item.attributes?.map(attr => attr.name) || []
      )
    )
  ).sort();
  
  const config = {
    ItemComponent: ItemCardWrapper,
    titles: {
      page: undefined,
    },
    groupByAttributes: itemsSchema.groupBy,
  };
  
  return (
    <>
      <ResourcePage
        config={config}
        items={items}
        loading={loading}
        error={error}
        canCreate={canEditItems}
        canEdit={canEditItems}
        canDelete={canEditItems}
        canConfigureSchema={canEditGroup}
        onConfigureSchema={handleConfigureSchema}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      {canEditItems && (
        <GroupItemModal 
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
          editingItem={editingItem}
          title={editingItem ? 'Редактирование предмета' : 'Создание предмета'}
        />
      )}

      {canEditGroup && (
        <SchemaModal
          isOpen={isSchemaModalOpen}
          onClose={() => setIsSchemaModalOpen(false)}
          onSave={handleSaveSchema}
          availableAttributes={availableAttributes}
          currentSchema={itemsSchema.groupBy}
          title="Настройка схемы группировки предметов"
        />
      )}
    </>
  );
};

export default GroupItems;