import React from 'react';
import { PageHeader, Panel } from '@tdn/shared';
import type { PresentationSurface } from './presentationModel';
import styles from './PresentationSurfaceFrame.module.css';

export type PresentationSurfaceFrameProps = {
  surface: PresentationSurface;
  title?: React.ReactNode;
  titleAside?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  headingLevel?: 2 | 3 | 4;
  widthMode?: 'responsive' | 'desktop' | 'mobile';
};

const PresentationSurfaceFrame: React.FC<PresentationSurfaceFrameProps> = ({ surface, title, titleAside, description, actions, children, headingLevel = 2, widthMode = 'responsive' }) => {
  if (surface === 'page') return <>{children}</>;
  const className = [styles.frame, styles[surface], styles[widthMode]].filter(Boolean).join(' ');
  if (surface === 'card') return <Panel as="article" className={className} density="compact" title={title} headingLevel={headingLevel} status={titleAside} description={description == null ? undefined : <div className={styles.cardDescription}>{description}</div>} actions={actions}>{children}</Panel>;
  return <div className={className}>
    <div className={styles.headerLayout}>
    <div className={styles.identity}><PageHeader title={title ?? ''} titleAside={titleAside} subtitle={description} actions={actions} headingLevel={headingLevel} /></div>
      <div className={styles.content}>{children}</div>
    </div>
  </div>;
};

export default PresentationSurfaceFrame;
