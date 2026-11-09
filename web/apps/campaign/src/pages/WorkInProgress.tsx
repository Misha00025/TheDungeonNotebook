import React from 'react';
import styles from '@tdn/shared/styles/common.module.css'

interface WorkInProgressProps {
    title: string
}


const WorkInProgress: React.FC<WorkInProgressProps> = ({
    title
}) => {

    return (
        <div className={styles.container}>
            <h1> Раздел "{title}" находится в разработке </h1>
        </div>
    )
}

export default WorkInProgress;