import { useNavigate, useOutletContext } from "react-router-dom";
import { TGroupContentContext } from "../../router/layouts/GroupContentLayout";
import { useAuth } from "../../store/AuthContent";
import { DetailContent } from "../DetailContent";
import { ItemService } from "../../utils/api/itemService";
import { Box, CircularProgress, Paper, Typography } from "@mui/material";
import defaultItemPicture from "../../assets/items/default_item.png";

/**
 * Component for displaying and editing an item
 */
export const Item = () => {
  const { token } = useAuth();
  const { itemsContext } = useOutletContext<TGroupContentContext>();
  const navigate = useNavigate();

  const activeItem = itemsContext.activeItem;

  const handleItemSave = async (description: string, title: string) => {
    try {
      if (!activeItem) return;

      const updatedItem = await ItemService.updateItem({
        ...activeItem,
        description,
        name: title,
      });

      // Update local state
      itemsContext.setItems([
        ...itemsContext.items.map((item) =>
          item.id === activeItem.id ? updatedItem : item,
        ),
      ]);
    } catch (error) {
      console.error("Failed to save item:", error);
    }
  };

  const handleItemDelete = async () => {
    try {
      if (!activeItem) return;

      await ItemService.deleteItem(activeItem.id);

      // Update local state
      itemsContext.setItems(
        itemsContext.items.filter((item) => item.id !== activeItem.id),
      );

      // Navigate back
      navigate("../");
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  if (!activeItem) {
    return <CircularProgress />;
  }

  const ItemFooter = (
    <Box
      sx={{
        height: 200,
        width: "100%",
        display: "flex",
        justifyContent: "end",
        gap: 1,
      }}
    >
      <Typography gutterBottom component="div" sx={{ marginTop: "auto" }}>
        Количество: {activeItem.amount || "???"}
      </Typography>
      <Paper
        src={activeItem.icon || defaultItemPicture}
        title={activeItem.name}
        component={"img"}
        sx={{ borderRadius: 4 }}
      />
    </Box>
  );

  return (
    <DetailContent
      title={activeItem.name}
      content={activeItem.description}
      footer={ItemFooter}
      onSave={handleItemSave}
      onDelete={handleItemDelete}
      isLoading={false}
    />
  );
};
