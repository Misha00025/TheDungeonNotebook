import React from "react";
import {
  Outlet,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { TGroupContentContext } from "../../router/layouts/GroupContentLayout";
import { CircularProgress, Typography, Box, Button } from "@mui/material";
import { usePlatform } from "../../store/PlatformContext";

export const ItemsListView = () => {
  const context = useOutletContext<TGroupContentContext>();
  const { itemsContext } = context;
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { platform } = usePlatform();
  const isMobile = platform === "touch";

  // Navigation functions for next/prev buttons
  const goToNextItem = () => {
    if (!itemId || !itemsContext.items.length) return;

    const currentIndex = itemsContext.items.findIndex(
      (item) => item.id === Number(itemId),
    );
    if (currentIndex === -1 || currentIndex === itemsContext.items.length - 1)
      return;

    const nextItem = itemsContext.items[currentIndex + 1];
    navigate(`../items/${nextItem.id}`);
  };

  const goToPrevItem = () => {
    if (!itemId || !itemsContext.items.length) return;

    const currentIndex = itemsContext.items.findIndex(
      (item) => item.id === Number(itemId),
    );
    if (currentIndex <= 0) return;

    const prevItem = itemsContext.items[currentIndex - 1];
    navigate(`../items/${prevItem.id}`);
  };

  // If we have an itemId, render the Outlet (Item component) with the context
  if (itemId) {
    // For mobile, put navigation buttons at the bottom
    const navigationButtons = (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: isMobile ? "none" : "1px solid var(--border-color)",
          borderTop: isMobile ? "1px solid var(--border-color)" : "none",
        }}
      >
        <Button
          onClick={goToPrevItem}
          disabled={
            !itemsContext.items.length ||
            itemsContext.items.findIndex(
              (item) => item.id === Number(itemId),
            ) <= 0
          }
        >
          Previous
        </Button>
        <Button
          onClick={goToNextItem}
          disabled={
            !itemsContext.items.length ||
            itemsContext.items.findIndex(
              (item) => item.id === Number(itemId),
            ) ===
              itemsContext.items.length - 1
          }
        >
          Next
        </Button>
      </div>
    );

    return (
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Navigation buttons at top for desktop, at bottom for mobile */}
        {!isMobile && navigationButtons}
        <div style={{ display: "flex", flex: 1, width: "100%" }}>
          <Outlet context={context} />
        </div>
        {isMobile && navigationButtons}
      </div>
    );
  }

  if (!itemsContext.items) {
    return <CircularProgress />;
  }

  // Common style for empty state
  const emptyStateStyle = {
    display: "flex",
    flex: 1,
    width: "100%",
    height: "100%",
    flexDirection: "column" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: "16px",
    backgroundColor: "var(--bg-primary)",
    border: "none",
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  if (itemsContext.items.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <Typography
          variant="h6"
          sx={{ marginBottom: 2, color: "var(--text-secondary)" }}
        >
          No items found
        </Typography>
        <Typography variant="body1" sx={{ color: "var(--text-secondary)" }}>
          Create a new item to get started
        </Typography>
      </div>
    );
  }

  // For mobile view, make it fullscreen without the "Select an item" text
  if (isMobile) {
    return (
      <div style={emptyStateStyle}>
        <Typography
          variant="h6"
          sx={{ marginBottom: 2, color: "var(--text-secondary)" }}
        >
          Tap on an item from the list
        </Typography>
      </div>
    );
  }

  return (
    <div style={emptyStateStyle}>
      <Typography
        variant="h6"
        sx={{ marginBottom: 2, color: "var(--text-secondary)" }}
      >
        Select an item to view its details
      </Typography>
    </div>
  );
};
