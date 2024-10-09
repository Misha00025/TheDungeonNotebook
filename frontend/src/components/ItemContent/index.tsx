import React, { ChangeEvent, useState } from "react";
import { TextareaAutosize } from "@mui/material";

import { IconButton } from "../IconButton";

import deleteIcon from "../../assets/carbon_trash-can.svg";
import editIcon from "../../assets/carbon_edit.svg";
import unsavedIcon from "../../assets/carbon_unsaved.svg";
import saveIcon from "../../assets/carbon_save.svg";

import "./index.css";

interface MultiLineTextProps {
  text?: string;
  isEditMode?: boolean;
  onChange: (value: ChangeEvent<HTMLTextAreaElement>) => void;
}

interface ItemContentProps {
  itemHeaderText: string;
  itemBodyText: string;
  itemFooter?: React.ReactNode;
  handleItemDelete: () => void;
  handleItemSave: (itemBodyText: string, itemTitleText: string) => void;
}

const MultiLineText: React.FC<MultiLineTextProps> = ({
  text,
  isEditMode = false,
  onChange,
}) => {
  return (
    <TextareaAutosize
      className={`item-multiLineText ${isEditMode ? "item-multiLineText__editing" : "item-multiLineText__readOnly"}`}
      spellCheck="true"
      name="itemText"
      value={text}
      onChange={onChange}
      readOnly={!isEditMode}
    />
  );
};

export const ItemContent: React.FC<ItemContentProps> = ({
  itemBodyText,
  itemHeaderText,
  itemFooter,
  handleItemDelete,
  handleItemSave,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeItemText, setActiveItemText] = useState(itemBodyText);
  const [activeItemHeader, setActiveItemHeader] = useState(itemHeaderText);

  React.useEffect(() => {
    setActiveItemText(itemBodyText);
    setActiveItemHeader(itemHeaderText);
  }, [itemBodyText, itemHeaderText, itemFooter]);

  const handleItemEditMode = () => {
    setIsEditMode((lastEditMode) => !lastEditMode);
  };

  const handleChangeItemText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setActiveItemText(event.target.value);
  };

  const handleChangeItemTitle = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setActiveItemHeader(event.target.value);
  };

  const handleItemEditSave = async () => {
    handleItemSave(activeItemText, activeItemHeader);
    setIsEditMode(false);
  };

  const handleItemEditCancel = () => {
    setActiveItemText(itemBodyText);
    setIsEditMode(false);
  };

  return (
    <div className="item">
      <div className="item-headerBox">
        <header className="item-headerTitle">
          <MultiLineText
            onChange={handleChangeItemTitle}
            text={activeItemHeader}
            isEditMode={isEditMode}
          />
        </header>
        <div className="item-headerActions">
          <IconButton
            icon={editIcon}
            tooltip="Редактировать"
            onClick={() => handleItemEditMode()}
          />
          <IconButton
            icon={deleteIcon}
            tooltip="Удалить"
            onClick={() => handleItemDelete()}
          />
        </div>
      </div>
      <div className="item-body">
        <MultiLineText
          text={activeItemText}
          isEditMode={isEditMode}
          onChange={handleChangeItemText}
        />
        {isEditMode && (
          <div className="item-editModeButtons">
            <IconButton
              text="Отменить"
              onClick={handleItemEditCancel}
              icon={unsavedIcon}
              color="red"
            />
            <IconButton
              text="Сохранить"
              onClick={handleItemEditSave}
              icon={saveIcon}
              color="green"
            />
          </div>
        )}
      </div>
      <div className="item-footer">{itemFooter}</div>
    </div>
  );
};
