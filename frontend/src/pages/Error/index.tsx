import React, { useEffect, useState } from 'react';
import { useRouteError } from 'react-router-dom';

import './index.css'

// Correct the paths if different
import dragon1 from '../../assets/errorPages/dragons/1.jpg';
import dragon2 from '../../assets/errorPages/dragons/2.jpg';
import dragon3 from '../../assets/errorPages/dragons/3.jpg';
import dragon4 from '../../assets/errorPages/dragons/4.jpg';

import dice1 from '../../assets/errorPages/dices/1.jpg';
import dice2 from '../../assets/errorPages/dices/2.jpg';
import dice3 from '../../assets/errorPages/dices/3.jpg';
import dice4 from '../../assets/errorPages/dices/4.jpg';

export const ErrorPage = () => {
    const error: any = useRouteError();
    const [picture, setPicture] = useState('');
    const [isDragonPage] = useState(Math.random() <= 0.5);

    console.error(error);

    useEffect(()=>{
        const dragonImages = [dragon1, dragon2, dragon3, dragon4];
        const diceImages = [dice1, dice2, dice3, dice4];
        let randomPicture = '';
    
        if (isDragonPage) {
            const randomIndex = Math.floor(Math.random() * dragonImages.length);
            randomPicture = dragonImages[randomIndex];
        } else {
            const randomIndex = Math.floor(Math.random() * diceImages.length);
            randomPicture = diceImages[randomIndex];
        }

        setPicture(randomPicture);
    }, []);

    return (
        <div className='errorPage-container'>
            <img className='error-picture' src={picture} alt="Error visual representation"/>
            <div>
                <h3>
                    <i>{error.statusText || error.message}</i>
                </h3>
                <p>{isDragonPage ? "Your page has been burned by a dragon" : "You rolled 1 and get Error Page :("}</p>

            </div>

        </div>
    );
}
