import React from "react";

import "./index.css";

interface ListContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const ListContainer = ({ children, className }: ListContainerProps) => {
  return <ul className={`listContainer ${className}`}>{children}</ul>;
};
