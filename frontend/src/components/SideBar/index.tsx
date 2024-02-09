import React from 'react'

import './index.css';
import { IconButton } from '../IconButton';

import githubIcon from '../../assets/carbon_logo-github.svg';
import exitIcon from '../../assets/carbon_exit.svg';
import settingIcon from '../../assets/carbon_settings.svg';
import { Link, useNavigate } from 'react-router-dom';

export const SideBar = () => {

  const navigate = useNavigate();

  const exitAction = () => {
    console.log('exit')
    navigate('/login');
  }
  return (
    <div className='sidebar'>
        <Link to={'https://github.com/Misha00025/TheDungeonNotebook'}>
          <IconButton icon={githubIcon} onClick={()=>console.log('click')}/>
        </Link>
        <IconButton icon={settingIcon} onClick={()=>console.log('click')}/>
        <IconButton icon={exitIcon} onClick={()=>exitAction()}/>
    </div>
  )
}
