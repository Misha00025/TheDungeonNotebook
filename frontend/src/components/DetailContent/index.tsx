import React, { ChangeEvent, useState } from "react";
import { TextareaAutosize, CircularProgress } from "@mui/material";
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

interface DetailContentProps {
  title: string;
  content: string;
  footer?: React.ReactNode;
  onDelete: () => Promise<void>;
  onSave: (content: string, title: string) => Promise<void>;
  isLoading?: boolean;
}

const MultiLineText: React.FC<MultiLineTextProps> = ({
  text,
  isEditMode = false,
  onChange,
}) => {
  // Use a regular textarea instead of TextareaAutosize to avoid ResizeObserver errors
  return (
    <textarea
      className={`detail-multiLineText ${isEditMode ? "detail-multiLineText__editing" : "detail-multiLineText__readOnly"}`}
      spellCheck="true"
      name="detailText"
      value={text}
      onChange={onChange}
      readOnly={!isEditMode}
      rows={isEditMode ? 10 : 5}
      style={{
        resize: isEditMode ? "vertical" : "none",
        flex: 1,
        width: "100%",
        height: "100%",
      }}
    />
  );
};

/**
 * A generic component for displaying and editing detail content (notes, items, etc.)
 */
export const DetailContent: React.FC<DetailContentProps> = ({
  title,
  content,
  footer,
  onDelete,
  onSave,
  isLoading = false,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeContent, setActiveContent] = useState(content);
  const [activeTitle, setActiveTitle] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update local state when props change
  React.useEffect(() => {
    setActiveContent(content);
    setActiveTitle(title);
  }, [content, title, footer]);

  const handleEditMode = () => {
    setIsEditMode((prevEditMode) => !prevEditMode);
  };

  const handleChangeContent = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setActiveContent(event.target.value);
  };

  const handleChangeTitle = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setActiveTitle(event.target.value);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(activeContent, activeTitle);
      setIsEditMode(false);
    } catch (error) {
      console.error("Failed to save:", error);
      // You could add error handling UI here
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setActiveContent(content);
    setActiveTitle(title);
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
    } catch (error) {
      console.error("Failed to delete:", error);
      // You could add error handling UI here
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="detail-loading">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="detail">
      <div className="detail-headerBox">
        <header className="detail-headerTitle">
          <MultiLineText
            onChange={handleChangeTitle}
            text={activeTitle}
            isEditMode={isEditMode}
          />
        </header>
        <div className="detail-headerActions">
          <IconButton
            icon={editIcon}
            tooltip="Редактировать"
            onClick={handleEditMode}
            disabled={isSaving || isDeleting}
          />
          <IconButton
            icon={deleteIcon}
            tooltip="Удалить"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
          />
        </div>
      </div>
      <div className="detail-body">
        <MultiLineText
          text={activeContent}
          isEditMode={isEditMode}
          onChange={handleChangeContent}
        />
        {isEditMode && (
          <div className="detail-editModeButtons">
            <IconButton
              text="Отменить"
              onClick={handleCancel}
              icon={unsavedIcon}
              color="red"
              disabled={isSaving}
            />
            <IconButton
              text="Сохранить"
              onClick={handleSave}
              icon={saveIcon}
              color="green"
              disabled={isSaving}
            >
              {isSaving && <CircularProgress size={16} />}
            </IconButton>
          </div>
        )}
      </div>
      <div className="detail-footer">{footer}</div>
    </div>
  );
};
