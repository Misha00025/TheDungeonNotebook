import React, { useEffect } from 'react'
import { SideBar } from '../../components/SideBar'

import './GroupsLayout.css'
import { Outlet, useNavigate } from 'react-router-dom'
import { Groups } from '../../pages/Groups'
import { useAuth } from '../../store/AuthContent'

export const GroupsLayout = () => {
    const { token } = useAuth();
    const navigate = useNavigate();

    const haveToken = token !== null && token !== undefined;
    console.log('token' + token);

    useEffect(() => {
      if (!haveToken) {
        navigate('/login');
      }
    }, [token]);

    if (!haveToken) {
      navigate('/login')
      return (
        <>
          token not found login redirect
        </>
      )
    };


    return (
      <>
          <main className='app-container'>
              {}
              <SideBar />
              <Groups />
              <Outlet />
          </main>
      </>
  )
}
