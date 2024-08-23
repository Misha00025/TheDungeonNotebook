import React, { useEffect, useState } from "react";
import { ListContainer } from "../ListContainer/Index";
import { ListItem } from "../ListItem";

import "./index.css";

interface ItemSelectorBoxProps {
  initialItemsCallback: () => Promise<void>;
  items?: Array<{ name: string; id: number }>;
  handleActiveItemChanged?: (itemId: number) => void;
  headerText: string;
  linkPrefix?: string;
  initialActiveItemId?: number;
  activeItemId?: number;
  refetchItemsOnChangeValue?: string;
  isHided?: boolean;
}

/**
 *
 * @param initialItemsCallback - Асинхронная функция, возвращающая Promise. В теле функции должен установить состояние items.
 * @param items - Массив объектов с полями name и id. Должен быть установлен например через initialItemsCallback.
 * @returns
 */
export const ItemSelectorBox: React.FC<ItemSelectorBoxProps> = ({
  initialItemsCallback,
  handleActiveItemChanged,
  headerText,
  linkPrefix,
  activeItemId = -1,
  refetchItemsOnChangeValue,
  items = [],
  isHided = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initialItemsCallback().then(() => {
      setIsLoading(false);
    });

    return () => setIsLoading(true);
  }, [refetchItemsOnChangeValue]);

  useEffect(() => {
    if (handleActiveItemChanged) {
      handleActiveItemChanged(activeItemId);
    }
  }, [activeItemId]);

  return (
    <div
      className={`itemSelectorBox-container ${isHided ? "itemSelectorBox-container__hided" : undefined}`}
    >
      <header className="itemSelectorBox-header">{headerText}</header>
      <ListContainer>
        {isLoading ? (
          <span className="itemSelectorBox-loader" />
        ) : (
          items.length === 0 && <p>Список пуст</p>
        )}
        {!isLoading &&
          items.map((item) => (
            <ListItem
              key={item.id}
              isActive={Number(item.id) === Number(activeItemId)}
              linkPath={linkPrefix && linkPrefix + item.id}
            >
              {item.name}
            </ListItem>
          ))}
      </ListContainer>
    </div>
  );
};
