import React, { Children } from "react";

import "./index.css";

interface ListContainerProps {
  children: React.ReactNode;
}

export const ListContainer = ({ children }: ListContainerProps) => {
  return <ul className="listContainer">{children}</ul>;
};
