import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { GroupsLayout } from "./layouts/GroupsLayout";
import { ErrorPage } from "../pages/Error";
import { Note } from "../components/Note";
import { Login } from "../pages/Login";
import { HomeLayout } from "./layouts/HomeLayout";
import { GroupContentLayout } from "./layouts/GroupContentLayout";
import { Item } from "../components/Item";
import { NotesListView } from "../components/NotesListView";
import { ItemsListView } from "../components/ItemsListView";

export const AppRouter = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <HomeLayout />,
      errorElement: <ErrorPage />,
      children: [
        {
          path: "groups",
          element: <GroupsLayout />,
          children: [
            {
              path: ":groupId",
              element: <GroupContentLayout />,
              children: [
                {
                  path: "notes",
                  element: <NotesListView />,
                  children: [
                    {
                      path: ":noteId",
                      element: <Note />,
                    },
                  ],
                },
                {
                  path: "items",
                  element: <ItemsListView />,
                  children: [
                    {
                      path: ":itemId",
                      element: <Item />,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      path: "/login",
      element: <Login />,
    },
  ]);

  return <RouterProvider router={router} />;
};
