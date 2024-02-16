import React from 'react'

import './index.css';
import { IconButton } from '../IconButton';

import githubIcon from '../../assets/carbon_logo-github.svg';
import exitIcon from '../../assets/carbon_exit.svg';
import settingIcon from '../../assets/carbon_settings.svg';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContent';

const PROJECT_GITHUB_URL = 'https://github.com/Misha00025/TheDungeonNotebook';

export const SideBar = () => {
  const { logout } = useAuth();

  const navigate = useNavigate();

  const exitAction = () => {
    logout();
    navigate('/login');
  }
  return (
    <div className='sidebar'>
        <Link to={PROJECT_GITHUB_URL}>
          <IconButton icon={githubIcon} tooltip='Страница на github' onClick={()=>undefined}/>
        </Link>
        <IconButton icon={settingIcon} tooltip='Настройки' onClick={()=>alert('Ха ха, ты думал тут что-то будет?')}/>
        <IconButton icon={exitIcon} tooltip='Перейти на страницу авторизации' onClick={()=>exitAction()}/>
    </div>
  )
}
