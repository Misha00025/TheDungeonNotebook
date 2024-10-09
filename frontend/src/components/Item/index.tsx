import { useNavigate, useOutletContext } from "react-router-dom";
import { TGroupContentContext } from "../../router/layouts/GroupContentLayout";
import { useAuth } from "../../store/AuthContent";
import { ItemContent } from "../ItemContent";
import { Api } from "../../utils/api";
import { Box, Paper, Typography } from "@mui/material";
import defaultItemPicture from "../../assets/items/default_item.png";

export const Item = () => {
  const { token } = useAuth();
  const { itemsContext } = useOutletContext<TGroupContentContext>();
  const navigate = useNavigate();

  const activeItem = itemsContext.activeItem;

  const handleItemSave = (description: string, title: string) => {
    Api.updateItem(
      {
        ...activeItem,
        description: description,
        name: title,
      },
      token,
    );
  };

  const handleItemDelete = () => {
    Api.deleteItem(activeItem?.id, token);
    navigate("../");
  };

  if (!activeItem) {
    return <>Active item is not defined!</>;
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
    <ItemContent
      itemBodyText={activeItem?.description}
      itemHeaderText={activeItem?.name}
      itemFooter={ItemFooter}
      handleItemSave={handleItemSave}
      handleItemDelete={handleItemDelete}
    />
  );
};
