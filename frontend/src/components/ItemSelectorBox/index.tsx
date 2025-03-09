import React, { useEffect, useState } from "react";
import { ListContainer } from "../ListContainer/Index";
import { ListItem } from "../ListItem";
import { IconButton } from "../IconButton";
import "./index.css";

import collapseIcon from "../../assets/mdi_arrow-collapse-left.svg";
import extendIcon from "../../assets/mdi_arrow-expand-right.svg";

/**
 * Interface for items displayed in the selector box
 */
export interface SelectorItem {
  id: number;
  name: string;
}

interface ItemSelectorBoxProps {
  /**
   * Callback to fetch items. Should set the items state internally.
   * Can optionally return the items for convenience.
   */
  initialItemsCallback: () => Promise<any>;

  /**
   * Array of items to display in the selector
   */
  items?: Array<SelectorItem>;

  /**
   * Callback when an item is selected
   */
  handleActiveItemChanged?: (itemId: number) => void;

  /**
   * Prefix for item links (e.g., "notes/" or "items/")
   */
  linkPrefix?: string;

  /**
   * ID of the initially active item
   */
  initialActiveItemId?: number;

  /**
   * ID of the currently active item
   */
  activeItemId?: number;

  /**
   * Value that triggers a refetch when changed
   */
  refetchItemsOnChangeValue?: string;

  /**
   * Whether the selector box should be hidden
   */
  isHided?: boolean;

  /**
   * Component to display in the header
   */
  headerComponent: React.ReactElement;
}

/**
 * A reusable component for selecting items from a list
 */
export const ItemSelectorBox: React.FC<ItemSelectorBoxProps> = ({
  initialItemsCallback,
  handleActiveItemChanged,
  linkPrefix,
  activeItemId = -1,
  refetchItemsOnChangeValue,
  items = [],
  isHided = false,
  headerComponent,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch items when the component mounts or refetchItemsOnChangeValue changes
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        await initialItemsCallback();
      } catch (error) {
        console.error("Error fetching items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();

    return () => setIsLoading(true);
  }, [refetchItemsOnChangeValue, initialItemsCallback]);

  // Notify parent when active item changes
  useEffect(() => {
    if (handleActiveItemChanged && activeItemId !== -1) {
      handleActiveItemChanged(activeItemId);
    }
  }, [activeItemId, handleActiveItemChanged]);

  const handleToggleCollapse = () => {
    setIsCollapsed((prevIsCollapsed) => !prevIsCollapsed);
  };

  // Determine container class names
  const containerClassNames = [
    "itemSelectorBox-container",
    isHided ? "itemSelectorBox-container__hided" : "",
    `itemSelectorBox-container__${isCollapsed ? "collapsed" : "expanded"}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassNames}>
      <div className="itemSelectorBox-header-container">
        {headerComponent}
        <IconButton
          icon={isCollapsed ? extendIcon : collapseIcon}
          onClick={handleToggleCollapse}
        />
      </div>
      <ListContainer>
        {isLoading ? (
          <span className="itemSelectorBox-loader" />
        ) : items.length === 0 ? (
          <p>Список пуст</p>
        ) : (
          items.map((item) => (
            <ListItem
              key={item.id}
              isActive={Number(item.id) === Number(activeItemId)}
              linkPath={linkPrefix ? `${linkPrefix}${item.id}` : undefined}
            >
              {item.name}
            </ListItem>
          ))
        )}
      </ListContainer>
    </div>
  );
};
