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

export const NotesListView = () => {
  const context = useOutletContext<TGroupContentContext>();
  const { notesContext } = context;
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { platform } = usePlatform();
  const isMobile = platform === "touch";

  // Navigation functions for next/prev buttons
  const goToNextNote = () => {
    if (!noteId || !notesContext.notes.length) return;

    const currentIndex = notesContext.notes.findIndex(
      (note) => note.id === Number(noteId),
    );
    if (currentIndex === -1 || currentIndex === notesContext.notes.length - 1)
      return;

    const nextNote = notesContext.notes[currentIndex + 1];
    navigate(`../notes/${nextNote.id}`);
  };

  const goToPrevNote = () => {
    if (!noteId || !notesContext.notes.length) return;

    const currentIndex = notesContext.notes.findIndex(
      (note) => note.id === Number(noteId),
    );
    if (currentIndex <= 0) return;

    const prevNote = notesContext.notes[currentIndex - 1];
    navigate(`../notes/${prevNote.id}`);
  };

  // If we have a noteId, render the Outlet (Note component) with the context
  if (noteId) {
    // For mobile, put navigation buttons at the bottom
    const isMobile = platform === "touch";
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
          onClick={goToPrevNote}
          disabled={
            !notesContext.notes.length ||
            notesContext.notes.findIndex(
              (note) => note.id === Number(noteId),
            ) <= 0
          }
        >
          Previous
        </Button>
        <Button
          onClick={goToNextNote}
          disabled={
            !notesContext.notes.length ||
            notesContext.notes.findIndex(
              (note) => note.id === Number(noteId),
            ) ===
              notesContext.notes.length - 1
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

  if (!notesContext.notes) {
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

  if (notesContext.notes.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <Typography
          variant="h6"
          sx={{ marginBottom: 2, color: "var(--text-secondary)" }}
        >
          No notes found
        </Typography>
        <Typography variant="body1" sx={{ color: "var(--text-secondary)" }}>
          Create a new note to get started
        </Typography>
      </div>
    );
  }

  // For mobile view, make it fullscreen without the "Select a note" text
  if (isMobile) {
    return (
      <div style={emptyStateStyle}>
        <Typography
          variant="h6"
          sx={{ marginBottom: 2, color: "var(--text-secondary)" }}
        >
          Tap on a note from the list
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
        Select a note to view its details
      </Typography>
    </div>
  );
};
