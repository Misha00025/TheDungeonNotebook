import { useNavigate, useParams } from "react-router-dom";
import { ItemSelectorBox } from "../../components/ItemSelectorBox";
import { Api, IGroup } from "../../utils/api";
import { useAuth } from "../../store/AuthContent";
import React, { useCallback } from "react";
import { usePlatform } from "../../store/PlatformContext";

const UNAUTHORIZED_ERROR_MESSAGE = `
Получена ошибка загрузки списка групп.
Похоже ваш авторизационный токен - протух.
Вы будете перенаправлены на страницу авторизации 😒😒😒
`;

export const Groups: React.FC = React.memo(function Groups() {
  const [groups, setGroups] = React.useState<IGroup[]>([]);
  const { platform } = usePlatform();
  const { groupId, noteId } = useParams();
  const { token, logout } = useAuth();

  const getGroups = useCallback(async () => {
    try {
      const fetchedGroups = await Api.fetchGroups(token);
      setGroups(fetchedGroups);
    } catch (err: any) {
      const error = JSON.parse(err.message);
      if (error.code === 401) {
        console.log(UNAUTHORIZED_ERROR_MESSAGE);
        logout();
      }
    }
  }, [token]);

  return (
    <ItemSelectorBox
      headerText="Список групп"
      initialItemsCallback={getGroups}
      items={groups}
      linkPrefix="/groups/"
      activeItemId={groupId ? Number(groupId) : undefined}
      isHided={noteId && platform === "touch" ? true : false}
    />
  );
});
