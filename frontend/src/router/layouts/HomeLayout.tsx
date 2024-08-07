import React, { useEffect } from 'react'
import { SideBar } from '../../components/SideBar'

import './HomeLayout.css'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContent'

export const HomeLayout = () => {
    const { token } = useAuth();
    const navigate = useNavigate();

    const haveToken = token !== null && token !== undefined;

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
              <SideBar />
              <Outlet />
          </main>
      </>
  )
}
