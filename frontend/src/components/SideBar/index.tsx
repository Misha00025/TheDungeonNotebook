import React from 'react'

import './index.css';
import { IconButton } from '../IconButton';

import githubIcon from '../../assets/carbon_logo-github.svg';
import exitIcon from '../../assets/carbon_exit.svg';
import settingIcon from '../../assets/carbon_settings.svg';
import { Link, useNavigate } from 'react-router-dom';

const PROJECT_GITHUB_URL = 'https://github.com/Misha00025/TheDungeonNotebook';

export const SideBar = () => {

  const navigate = useNavigate();

  const exitAction = () => {
    navigate('/login');
  }
  return (
    <div className='sidebar'>
        <Link to={PROJECT_GITHUB_URL}>
          <IconButton icon={githubIcon} tooltip='Страница на github' onClick={()=>console.log('click')}/>
        </Link>
        <IconButton icon={settingIcon} tooltip='Настройки' onClick={()=>console.log('click')}/>
        <IconButton icon={exitIcon} tooltip='Перейти на страницу авторизации' onClick={()=>exitAction()}/>
    </div>
  )
}
