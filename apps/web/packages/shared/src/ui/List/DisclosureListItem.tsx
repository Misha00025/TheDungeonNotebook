import React, { forwardRef, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Badge } from '../Panel/Panel';
import styles from './DisclosureListItem.module.css';

export type DisclosureListItemTag = {
  key: string;
  label: string;
};

export type DisclosureListItemProps = Omit<HTMLAttributes<HTMLElement>, 'title' | 'children'> & {
  title: string;
  titleAside?: ReactNode;
  description?: string;
  tags?: readonly DisclosureListItemTag[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  actions?: ReactNode;
  summaryStatus?: string;
  children?: ReactNode;
  previewLength?: number;
};

function previewText(value: string, maxLength: number): string {
  const collapsed = value.replace(/\s+/gu, ' ').trim();
  const characters = Array.from(collapsed);
  const limit = Math.max(0, maxLength);
  if (characters.length <= limit) return collapsed;
  let prefix = characters.slice(0, limit);
  const lastSpace = prefix.lastIndexOf(' ');
  if (lastSpace > 0 && characters[limit] !== undefined && !/\s/u.test(characters[limit])) {
    prefix = prefix.slice(0, lastSpace);
  }
  return `${prefix.join('').trimEnd()}…`;
}

const DisclosureListItem = forwardRef<HTMLElement, DisclosureListItemProps>(function DisclosureListItem({
  title,
  titleAside,
  description,
  tags = [],
  expanded,
  onExpandedChange,
  actions,
  summaryStatus,
  children,
  previewLength = 160,
  className,
  style,
  ...props
}, forwardedRef) {
  const id = useId();
  const bodyId = `${id}-body`;
  const descriptionId = `${id}-description`;
  const tagAreaId = `${id}-tags`;
  const rootRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLSpanElement>(null);
  const titleGroupRef = useRef<HTMLSpanElement>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const titleAsideRef = useRef<HTMLSpanElement>(null);
  const tagAreaRef = useRef<HTMLSpanElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const tagMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const counterMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [visibleTagCount, setVisibleTagCount] = useState(0);
  const [showCounter, setShowCounter] = useState(false);
  const [actionsWidth, setActionsWidth] = useState(0);
  const tagSignature = useMemo(() => tags.map(tag => `${tag.key}\u0000${tag.label}`).join('\u0001'), [tags]);
  const preview = description === undefined
    ? summaryStatus ?? ''
    : description.length === 0
      ? 'Описание отсутствует.'
      : previewText(description, previewLength);
  const shownTags = expanded ? tags : tags.slice(0, visibleTagCount);
  const hiddenTagCount = tags.length - visibleTagCount;
  const hasShownSummary = !expanded && (visibleTagCount > 0 || showCounter);
  const hasActions = actions != null && actionsWidth > 0;
  const rootStyle = {
    ...style,
    ...(actionsWidth > 0 ? { '--disclosure-actions-width': `${actionsWidth}px` } : {}),
  } as CSSProperties;

  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLElement);

  useLayoutEffect(() => {
    const actionsElement = actionsRef.current;
    const measure = () => {
      const width = actionsElement ? Math.ceil(actionsElement.getBoundingClientRect().width) : 0;
      setActionsWidth(current => current === width ? current : width);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    if (actionsElement) observer.observe(actionsElement);
    return () => observer.disconnect();
  }, [actions != null]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const titleGroup = titleGroupRef.current;
    const titleElement = titleMeasureRef.current;
    const tagArea = tagAreaRef.current;
    if (!header || !titleGroup || !titleElement || !tagArea) return;

    const measure = () => {
      const headerStyle = getComputedStyle(header);
      const headerPadding = (Number.parseFloat(headerStyle.paddingInlineStart) || 0)
        + (Number.parseFloat(headerStyle.paddingInlineEnd) || 0);
      const availableWidth = Math.max(0, header.clientWidth - headerPadding);
      if (availableWidth <= 0 || tags.length === 0) {
        setVisibleTagCount(current => current === 0 ? current : 0);
        setShowCounter(current => current ? false : current);
        return;
      }

      const nameWidth = titleElement.getBoundingClientRect().width;
      const asideWidth = titleAsideRef.current?.getBoundingClientRect().width ?? 0;
      const titleGap = Number.parseFloat(getComputedStyle(titleGroup).columnGap) || 0;
      const titleWidth = nameWidth + (asideWidth > 0 ? asideWidth + titleGap : 0);
      const headerGap = Number.parseFloat(headerStyle.columnGap) || 0;
      const tagGap = Number.parseFloat(getComputedStyle(tagArea).columnGap) || 0;
      const tagWidths = tags.map((_, index) => tagMeasureRefs.current[index]?.getBoundingClientRect().width ?? 0);
      const titleBudget = Math.min(titleWidth, availableWidth * 0.65);
      const tagBudget = availableWidth - titleBudget - headerGap;
      const allWidth = tagWidths.reduce((total, width) => total + width, 0)
        + tagGap * Math.max(0, tags.length - 1);

      if (allWidth <= tagBudget) {
        setVisibleTagCount(current => current === tags.length ? current : tags.length);
        setShowCounter(current => current ? false : current);
        return;
      }

      let bestCount = -1;
      for (let count = 0; count < tags.length; count += 1) {
        const remaining = tags.length - count;
        const counterWidth = counterMeasureRefs.current[remaining]?.getBoundingClientRect().width ?? 0;
        const prefixWidth = tagWidths.slice(0, count).reduce((total, width) => total + width, 0)
          + tagGap * Math.max(0, count - 1);
        const requiredWidth = prefixWidth + (count > 0 ? tagGap : 0) + counterWidth;
        if (requiredWidth <= tagBudget) bestCount = count;
      }

      if (bestCount < 0) {
        setVisibleTagCount(current => current === 0 ? current : 0);
        setShowCounter(current => current ? false : current);
      } else {
        setVisibleTagCount(current => current === bestCount ? current : bestCount);
        setShowCounter(true);
      }
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (measureRef.current) observer.observe(measureRef.current);
    if (actionsRef.current) observer.observe(actionsRef.current);
    if (titleAsideRef.current) observer.observe(titleAsideRef.current);
    return () => observer.disconnect();
  }, [expanded, tagSignature, tags.length, title, titleAside, actionsWidth]);

  return (
    <article
      {...props}
      ref={rootRef}
      className={[styles.item, hasActions && styles.hasActions, className].filter(Boolean).join(' ')}
      style={rootStyle}
    >
      <button
        type="button"
        className={styles.toggle}
        aria-label={title}
        aria-expanded={expanded}
        aria-controls={`${descriptionId} ${tagAreaId} ${bodyId}`}
        onClick={() => onExpandedChange(!expanded)}
      >
        <span ref={headerRef} className={[
          styles.header,
          expanded && styles.expandedHeader,
          hasShownSummary && styles.summaryHeader,
        ].filter(Boolean).join(' ')}>
          <span ref={titleGroupRef} className={styles.titleGroup}>
            <span className={styles.title}>{title}</span>
            {titleAside != null && <span ref={titleAsideRef} className={styles.titleAside}>{titleAside}</span>}
          </span>
          <span id={tagAreaId} ref={tagAreaRef} className={[styles.tagArea, expanded && styles.expandedTagArea].filter(Boolean).join(' ')}>
            {shownTags.map(tag => <Badge key={tag.key}>{tag.label}</Badge>)}
            {!expanded && showCounter && <Badge key="overflow">+ ещё {hiddenTagCount}</Badge>}
          </span>
        </span>
      </button>
      <div id={descriptionId} className={[styles.description, expanded && styles.descriptionExpanded].filter(Boolean).join(' ')}>
        {expanded
          ? description === undefined ? summaryStatus ?? '' : description.length > 0 ? description : 'Описание отсутствует.'
          : preview}
      </div>
      <div id={bodyId} className={styles.body} hidden={!expanded}>
        {expanded && children}
      </div>
      {actions != null && <div ref={actionsRef} className={styles.actions}>{actions}</div>}
      <div className={styles.measurementHost} aria-hidden="true">
        <div ref={measureRef} className={styles.measure}>
          <span ref={titleMeasureRef} className={styles.measureTitle}>{title}</span>
          {tags.map((tag, index) => <span
            key={tag.key}
            ref={element => { tagMeasureRefs.current[index] = element; }}
            className={styles.measureBadge}
          ><Badge>{tag.label}</Badge></span>)}
          {tags.map((_, index) => {
            const remaining = tags.length - index;
            return <span
              key={`counter-${remaining}`}
              ref={element => { counterMeasureRefs.current[remaining] = element; }}
              className={styles.measureBadge}
            ><Badge>+ ещё {remaining}</Badge></span>;
          })}
        </div>
      </div>
    </article>
  );
});

export default DisclosureListItem;
