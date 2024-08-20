import { useNavigate, useParams } from "react-router-dom";
import { ItemSelectorBox } from "../../components/ItemSelectorBox";
import { Api } from "../../utils/api";
import { useAuth } from "../../store/AuthContent";
import React, { useCallback } from "react";
import { usePlatform } from "../../store/PlatformContext";

const UNAUTHORIZED_ERROR_MESSAGE = `
Получена ошибка загрузки списка групп.
Похоже ваш авторизационный токен - протух.
Вы будете перенаправлены на страницу авторизации 😒😒😒
`;

export const Groups: React.FC = React.memo(function Groups() {
  const { platform } = usePlatform();
  const { groupId, noteId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const getGroups = useCallback(async () => {
    try {
      return await Api.fetchGroups(token);
    } catch (err: any) {
      try {
        const error = JSON.parse(err.message);
        if (error.code === 401) {
          navigate("/login");
          console.log(UNAUTHORIZED_ERROR_MESSAGE);
        }
        return [];
      } catch {
        throw err;
      }
    }
  }, [token]);

  return (
    <ItemSelectorBox
      headerText="Список групп"
      initialItemsCallback={getGroups}
      linkPrefix="/groups/"
      activeItemId={groupId ? Number(groupId) : undefined}
      isHided={noteId && platform === "touch" ? true : false}
    />
  );
});
