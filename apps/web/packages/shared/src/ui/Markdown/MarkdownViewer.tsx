import React from 'react';
import ReactMarkdown from 'react-markdown';
import useMarkdownColorMode from './useMarkdownColorMode';
import styles from './Markdown.module.css';

export interface MarkdownViewerProps {
  value: string;
  className?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ value, className }) => {
  const colorMode = useMarkdownColorMode();
  return <div className={[styles.viewer, className].filter(Boolean).join(' ')} data-color-mode={colorMode}>
    <ReactMarkdown skipHtml>{value}</ReactMarkdown>
  </div>;
};

export default MarkdownViewer;
