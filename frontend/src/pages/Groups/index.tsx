import { useNavigate, useParams } from 'react-router-dom';
import { ItemSelectorBox } from '../../components/ItemSelectorBox'
import { Api } from '../../utils/api';
import { useAuth } from '../../store/AuthContent';
import React, { useCallback } from 'react';

export const Groups: React.FC = () => {
    const { groupId } = useParams();
    const { token } = useAuth();

    const fetchGroups = useCallback(() => Api.fetchGroups(token), [token]);
  return (
    <ItemSelectorBox 
        headerText='Список групп'
        initialItemsCallback={fetchGroups}
        linkPrefix='groups/'
        activeItemId={groupId ? Number(groupId) : undefined}
    />
  );
}
