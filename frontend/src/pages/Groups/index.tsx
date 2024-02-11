import { useNavigate, useParams } from 'react-router-dom';
import { ItemSelectorBox } from '../../components/ItemSelectorBox'
import { Api } from '../../utils/api';
import { useAuth } from '../../store/AuthContent';
import { useCallback } from 'react';

const mockListItems = () => {
    const items = [];
    for (let i = 0; i < 4; i++) {
        items.push(
            {
                text: `Тест-ролёвка (недоделкины вперёд!) ${i}`,
                vkId: i
            }
        )
    }

    return Promise.resolve(items);
}

export const Groups = () => {
    const { groupId } = useParams();
    const { token } = useAuth();

    const fetchGroups = useCallback(() => Api.fetchGroups(token), [])

    console.log(groupId + 'check initial');
    console.log('rerender... groups')
  return (
    <ItemSelectorBox 
        headerText='Список групп'
        initialItemsCallback={fetchGroups}
        linkPrefix='groups/'
        activeItemId={groupId ? Number(groupId) : undefined}
    />
  );
}
