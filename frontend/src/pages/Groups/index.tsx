import { useNavigate, useParams } from 'react-router-dom';
import { ItemSelectorBox } from '../../components/ItemSelectorBox'
import { Api } from '../../utils/api';
import { useAuth } from '../../store/AuthContent';

const mockListItems = () => {
    const items = [];
    for (let i = 0; i < 4; i++) {
        items.push(
            {
                text: `Тест-ролёвка (недоделкины вперёд!) ${i}`,
                id: i
            }
        )
    }

    return Promise.resolve(items);
}

export const Groups = () => {
    const { groupId } = useParams();
    const { token } = useAuth();
    console.log(groupId);

  return (
    <ItemSelectorBox 
        headerText='Список групп'
        initialItemsCallback={() => Api.fetchGroups(token)}
        linkPrefix='groups/'
        initialActiveItemId={groupId ? Number(groupId) : undefined}
    />
  );
}
