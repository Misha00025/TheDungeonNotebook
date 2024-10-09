import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { GroupsLayout } from "./layouts/GroupsLayout";
import { ErrorPage } from "../pages/Error";
import { Note } from "../components/Note";
import { Login } from "../pages/Login";
import { HomeLayout } from "./layouts/HomeLayout";
import { GroupContentLayout } from "./layouts/GroupContentLayout";
import { Item } from "../components/Item";

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
                  children: [
                    {
                      path: ":noteId",
                      element: <Note />,
                    },
                  ],
                },
                {
                  path: "items",
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
