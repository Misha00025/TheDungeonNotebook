import React, { memo, useEffect, useState } from 'react'
import { ListContainer } from '../ListContainer/Index'
import { ListItem } from '../ListItem';

import "./index.css"
import { useAuth } from '../../store/AuthContent';

interface ItemSelectorBoxProps {
    initialItemsCallback: () => Promise<Array<{name: string; id: number}>>;
    handleActiveItemChanged?: (itemId: number) => void
    headerText: string;
    linkPrefix?: string;
    initialActiveItemId?: number;
    activeItemId?: number;
    refetchItemsOnChangeValue?: string;
}

export const ItemSelectorBox: React.FC<ItemSelectorBoxProps> = ({
    initialItemsCallback,
    handleActiveItemChanged,
    headerText,
    linkPrefix,
    activeItemId = -1,
    refetchItemsOnChangeValue
}) => {
    const [items, setItems] = useState<Array<{name: string; id: number}>>([]);

    useEffect(() => {
        initialItemsCallback().then(value => setItems(value));
    }, [refetchItemsOnChangeValue]);


    useEffect(() => {
        if (handleActiveItemChanged) {
            handleActiveItemChanged(activeItemId);
        }
    }, [activeItemId]);

    return (
        <div className='itemSelectorBox-container'>
            <header className='itemSelectorBox-header'>
                {headerText}
            </header>
            <ListContainer>
                {
                    items.map(item => (
                            <ListItem 
                                key={item.id}
                                isActive={Number(item.id) === Number(activeItemId)}
                                linkPath={linkPrefix && linkPrefix + item.id}
                            >
                                {item.name}
                            </ListItem>
                    ))
                }
            </ListContainer>
        </div>
  )
}
