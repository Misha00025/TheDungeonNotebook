import React, { useCallback, useEffect, useState } from "react";

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { ItemSelectorBox } from "../../components/ItemSelectorBox";
import { useAuth } from "../../store/AuthContent";
import { Api, IItem, INote } from "../../utils/api";
import { usePlatform } from "../../store/PlatformContext";
import Tab from "@mui/material/Tab/Tab";
import Tabs from "@mui/material/Tabs/Tabs";

interface ContentTypeTabsProps {
  setActiveTab: (value: string) => void;
  activeTab: string;
}

export type TGroupContentContext = {
  itemsContext: {
    items: Array<IItem>;
    setActiveItem: React.Dispatch<React.SetStateAction<IItem>>;
    setNotes: React.Dispatch<React.SetStateAction<IItem[]>>;
    activeItem: IItem;
  };
  notesContext: {
    notes: Array<INote>;
    setActiveNote: React.Dispatch<React.SetStateAction<INote>>;
    setNotes: React.Dispatch<React.SetStateAction<INote[]>>;
    activeNote: INote;
  };
};

const setItemById = (
  callback: (value: any) => void,
  id: number,
  itemsArray: Array<any>,
) => {
  callback(itemsArray.find((item) => item.id === Number(id)));
};

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

  const [activeTab, setActiveTab] = useState("notes");

  const [items, setItems] = useState<IItem[]>([]);
  const [activeItem, setActiveItem] = useState<IItem>();

  const [notes, setNotes] = useState<INote[]>([]);
  const [activeNote, setActiveNote] = useState<INote>();

  // const { setActiveNoteById, setNotes, notes } = useNotes();
  const { token } = useAuth();
  const { platform } = usePlatform();
  const location = useLocation();

  console.log(activeItem);

  useEffect(() => {
    if (itemId || noteId) {
      setActiveTab(itemId ? "items" : "notes");
    }
  }, []);

  useEffect(() => {
    setItemById(setActiveNote, Number(noteId), notes);
  }, [noteId, notes]);

  useEffect(() => {
    setItemById(setActiveItem, Number(itemId), items);
  }, [itemId, items]);

  const fetchNotes = useCallback(async () => {
    console.log("Fetching notes");
    if (groupId && setNotes) {
      await Api.fetchNotes(Number(groupId), token).then((notes) => {
        setNotes(notes);
        return notes.map((note) => ({ id: note.id, name: note.header }));
      });
    } else {
      throw new Error("Error while setting initialItemsCallback for notes");
    }
  }, [groupId]);

  const fetchItems = async () => {
    console.log("Fetching items");
    if (groupId && token) {
      await Api.fetchItems(Number(groupId), token).then((items) => {
        setItems(items);
        return items.map((item) => ({ id: item.id, name: item.name }));
      });
    } else {
      throw new Error("Error while setting initialItemsCallback for notes");
    }
  };

  const handleActiveItemChanged = (id: number) => {
    if (activeTab === "notes") {
      setItemById(setActiveNote, id, notes);
    }

    if (activeTab === "items") {
      if (notes) {
        setItemById(setActiveItem, id, items);
      }
    }
  };

  const boxElements =
    activeTab === "notes"
      ? notes?.map((note) => ({ id: note.id, name: note.header }))
      : items.map((item) => ({ id: item.id, name: item.name }));
  // TODO: переделать на общий компонент селектора активного айтема.
  return (
    <>
      <ItemSelectorBox
        refetchItemsOnChangeValue={groupId + activeTab}
        headerComponent={
          <ContentTypeTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        }
        handleActiveItemChanged={handleActiveItemChanged}
        linkPrefix={activeTab === "notes" ? "notes/" : "items/"}
        initialItemsCallback={activeTab === "notes" ? fetchNotes : fetchItems}
        activeItemId={
          activeTab === "notes" && noteId ? Number(noteId) : Number(itemId)
        }
        isHided={(noteId || itemId) && platform === "touch" ? true : false}
        items={boxElements}
      />
      <Outlet
        context={
          {
            itemsContext: { items, setItems, setActiveItem, activeItem },
            notesContext: { notes, setNotes, setActiveNote, activeNote },
          } as unknown as TGroupContentContext
        }
      />
    </>
  );
};
