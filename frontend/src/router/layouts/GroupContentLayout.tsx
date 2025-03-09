import React, { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ItemSelectorBox } from "../../components/ItemSelectorBox";
import { useAuth } from "../../store/AuthContent";
import { Api, IItem, INote } from "../../utils/api";
import { usePlatform } from "../../store/PlatformContext";
import Tab from "@mui/material/Tab/Tab";
import Tabs from "@mui/material/Tabs/Tabs";
import "./GroupContentLayout.css";

// Types
export type TGroupContentContext = {
  itemsContext: {
    items: Array<IItem>;
    setActiveItem: React.Dispatch<React.SetStateAction<IItem>>;
    setItems: React.Dispatch<React.SetStateAction<IItem[]>>;
    activeItem: IItem;
  };
  notesContext: {
    notes: Array<INote>;
    setActiveNote: React.Dispatch<React.SetStateAction<INote>>;
    setNotes: React.Dispatch<React.SetStateAction<INote[]>>;
    activeNote: INote;
  };
};

interface ContentTypeTabsProps {
  setActiveTab: (value: string) => void;
  activeTab: string;
}

// Helper functions
const findItemById = <T extends { id: number }>(
  id: number,
  itemsArray: Array<T>,
): T | undefined => {
  return itemsArray.find((item) => item.id === Number(id));
};

const setItemById = <T extends { id: number }>(
  callback: (value: T | undefined) => void,
  id: number,
  itemsArray: Array<T>,
) => {
  callback(findItemById(id, itemsArray));
};

// Tab navigation component
const ContentTypeTabs: React.FC<ContentTypeTabsProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const navigate = useNavigate();

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    navigate(newValue);
    setActiveTab(newValue);
  };

  return (
    <Tabs
      className="itemSelectorBox-header-text"
      value={activeTab}
      onChange={handleChange}
      variant="scrollable"
      scrollButtons="auto"
    >
      <Tab value="notes" label="Заметки" />
      <Tab value="items" label="Предметы" />
    </Tabs>
  );
};

export const GroupContentLayout = () => {
  const { groupId, noteId, itemId } = useParams();
  const { token } = useAuth();
  const { platform } = usePlatform();
  const location = useLocation();

  // State
  const [activeTab, setActiveTab] = useState("notes");
  const [items, setItems] = useState<IItem[]>([]);
  const [activeItem, setActiveItem] = useState<IItem>();
  const [notes, setNotes] = useState<INote[]>([]);
  const [activeNote, setActiveNote] = useState<INote>();

  // Set active tab based on URL
  useEffect(() => {
    if (itemId || noteId) {
      setActiveTab(itemId ? "items" : "notes");
    }
  }, [itemId, noteId]);

  // Update active note when noteId or notes change
  useEffect(() => {
    if (noteId && notes.length > 0) {
      setItemById(setActiveNote, Number(noteId), notes);
    }
  }, [noteId, notes]);

  // Update active item when itemId or items change
  useEffect(() => {
    if (itemId && items.length > 0) {
      setItemById(setActiveItem, Number(itemId), items);
    }
  }, [itemId, items]);

  // Data fetching functions
  const fetchNotes = useCallback(async () => {
    console.log("Fetching notes");
    if (!groupId || !token) {
      throw new Error("Missing groupId or token for fetching notes");
    }

    try {
      const fetchedNotes = await Api.fetchNotes(Number(groupId), token);
      setNotes(fetchedNotes);
      return fetchedNotes.map((note) => ({ id: note.id, name: note.header }));
    } catch (error) {
      console.error("Error fetching notes:", error);
      throw new Error("Failed to fetch notes");
    }
  }, [groupId, token]);

  const fetchItems = useCallback(async () => {
    console.log("Fetching items");
    if (!groupId || !token) {
      throw new Error("Missing groupId or token for fetching items");
    }

    try {
      const fetchedItems = await Api.fetchItems(Number(groupId), token);
      setItems(fetchedItems);
      return fetchedItems.map((item) => ({ id: item.id, name: item.name }));
    } catch (error) {
      console.error("Error fetching items:", error);
      throw new Error("Failed to fetch items");
    }
  }, [groupId, token]);

  // Handle item selection
  const handleActiveItemChanged = (id: number) => {
    if (activeTab === "notes") {
      setItemById(setActiveNote, id, notes);
    } else if (activeTab === "items") {
      setItemById(setActiveItem, id, items);
    }
  };

  // Prepare data for ItemSelectorBox
  const boxElements =
    activeTab === "notes"
      ? notes.map((note) => ({ id: note.id, name: note.header }))
      : items.map((item) => ({ id: item.id, name: item.name }));

  const isItemSelected =
    (noteId || itemId) && platform === "touch" ? true : false;

  return (
    <div className="group-content-layout">
      <div
        className={`left-column ${platform === "touch" ? "left-column-touch" : "left-column-desktop"} ${
          platform === "touch" && !isItemSelected
            ? "left-column-fullscreen"
            : ""
        }`}
      >
        <ItemSelectorBox
          refetchItemsOnChangeValue={`${groupId}-${activeTab}`}
          headerComponent={
            <ContentTypeTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          }
          handleActiveItemChanged={handleActiveItemChanged}
          linkPrefix={activeTab === "notes" ? "notes/" : "items/"}
          initialItemsCallback={activeTab === "notes" ? fetchNotes : fetchItems}
          activeItemId={
            activeTab === "notes" && noteId ? Number(noteId) : Number(itemId)
          }
          isHided={isItemSelected}
          items={boxElements}
        />
      </div>
      <div className="right-column">
        <Outlet
          context={{
            itemsContext: { items, setItems, setActiveItem, activeItem },
            notesContext: { notes, setNotes, setActiveNote, activeNote },
          }}
        />
      </div>
    </div>
  );
};
