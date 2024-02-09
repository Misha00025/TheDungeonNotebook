import React, { useEffect, useState } from 'react'
import { ListContainer } from '../ListContainer/Index'
import { ListItem } from '../ListItem';

import "./index.css"

interface ItemSelectorBoxProps {
    initialItemsCallback: () => Promise<Array<{name: string; id: number}>>;
    headerText: string;
    linkPrefix?: string;
    initialActiveItemId?: number;
}

export const ItemSelectorBox = ({
    initialItemsCallback,
    headerText,
    linkPrefix,
    initialActiveItemId = -1
}: ItemSelectorBoxProps) => {
    const [activeItemId, setActiveItemId] = useState(initialActiveItemId);
    const [items, setItems] = useState<Array<{name: string; id: number}>>([]);

    useEffect(() => {
        initialItemsCallback().then(value => setItems(value));
    }, []);

    useEffect(() => {
        setActiveItemId(initialActiveItemId)
    }, [initialActiveItemId]);


    const makeActiveGroup = (id: number) => {
        setActiveItemId(id);
    }

    return (
        <div className='itemSelectorBox-container'>
            <header>
                {headerText}
            </header>
            <ListContainer>
                {
                    items.map(item => (
                            <ListItem 
                                key={item.id}
                                isActive={item.id === activeItemId}
                                linkPath={linkPrefix && linkPrefix + item.id}
                                onClick={() => makeActiveGroup(item.id)}
                            >
                                {item.name}
                            </ListItem>
                    ))
                }
            </ListContainer>
        </div>
  )
}
