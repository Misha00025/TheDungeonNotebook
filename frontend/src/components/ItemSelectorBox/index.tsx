import React, { memo, useEffect, useState } from "react";
import { ListContainer } from "../ListContainer/Index";
import { ListItem } from "../ListItem";

import "./index.css";

interface ItemSelectorBoxProps {
  initialItemsCallback: () => Promise<Array<{ name: string; id: number }>>;
  handleActiveItemChanged?: (itemId: number) => void;
  headerText: string;
  linkPrefix?: string;
  initialActiveItemId?: number;
  activeItemId?: number;
  refetchItemsOnChangeValue?: string;
  isHided?: boolean;
}

export const ItemSelectorBox: React.FC<ItemSelectorBoxProps> = ({
  initialItemsCallback,
  handleActiveItemChanged,
  headerText,
  linkPrefix,
  activeItemId = -1,
  refetchItemsOnChangeValue,
  isHided = false,
}) => {
  const [items, setItems] = useState<Array<{ name: string; id: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initialItemsCallback().then((value) => {
      setItems(value);
      setIsLoading(false);
    });
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
        {items.map((item) => (
          <ListItem
            key={item.id}
            isActive={Number(item.id) === Number(activeItemId)}
            linkPath={linkPrefix && linkPrefix + item.id}
          >
            {item.name}
          </ListItem>
        ))}
        {}
        {isLoading ? (
          <span className="itemSelectorBox-loader" />
        ) : (
          items.length === 0 && <p>Список пуст</p>
        )}
      </ListContainer>
    </div>
  );
};
