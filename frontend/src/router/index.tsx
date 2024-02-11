import React from 'react'
import {
    createBrowserRouter,
    RouterProvider,
  } from "react-router-dom";
import { GroupsLayout } from './layouts/GroupsLayout';
import { NotesLayout } from './layouts/NotesLayout';
import { ErrorPage } from '../pages/Error';
import { Note } from '../components/Note';
import { Login } from '../pages/Login';


export const AppRouter = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <GroupsLayout />,
            errorElement: <ErrorPage />,
            children: [{
                path: "groups/:groupId",
                element: <NotesLayout />,
                children: [{
                    path: "notes/:noteId",
                    element: <Note />
                }]
            }]
        },
        {
            path: "/login",
            element: <Login />
        }
    ])
  return (
    <RouterProvider router={router} />
  )
}
