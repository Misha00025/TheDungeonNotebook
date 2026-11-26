import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { MDEditorProps } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import useMarkdownColorMode from './useMarkdownColorMode';
import styles from './Markdown.module.css';

export type MarkdownEditorProps = Omit<
  MDEditorProps,
  'value' | 'onChange' | 'id' | 'className' | 'height' | 'preview' | 'previewOptions' | 'textareaProps' | 'data-color-mode' | 'hideToolbar'
> & {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  height?: MDEditorProps['height'];
  preview?: MDEditorProps['preview'];
  className?: string;
  previewOptions?: MDEditorProps['previewOptions'];
  textareaProps?: MDEditorProps['textareaProps'];
  hideToolbar?: boolean;
};

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  id,
  disabled = false,
  height = 300,
  preview = 'edit',
  className,
  previewOptions,
  textareaProps,
  hideToolbar = false,
  ...editorProps
}) => {
  const colorMode = useMarkdownColorMode();
  const isDisabled = disabled || Boolean(textareaProps?.disabled);
  const editorClassName = [styles.editor, className].filter(Boolean).join(' ');

  return <div className={styles.editorFrame}>
    <MDEditor
      {...editorProps}
      className={editorClassName}
      data-color-mode={colorMode}
      value={value}
      onChange={nextValue => onChange(nextValue ?? '')}
      height={height}
      preview={preview}
      hideToolbar={isDisabled || hideToolbar}
      previewOptions={{ ...previewOptions, skipHtml: true }}
      textareaProps={{
        ...textareaProps,
        ...(id === undefined && textareaProps?.id === undefined ? {} : { id: id ?? textareaProps?.id }),
        disabled: isDisabled,
      }}
    />
  </div>;
};

export default MarkdownEditor;
