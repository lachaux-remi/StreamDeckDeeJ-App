import { ReactElement, ReactNode } from "react";

import Action from "@/components/page-actions/Action";

import "./PageActions.scss";

export type PageAction = ReactElement<typeof Action>;

type PageActionsProps = {
  children: ReactNode;
};

const PageActions = (props: PageActionsProps) => {
  const { children } = props;
  return <div className="page-actions">{children}</div>;
};

export default PageActions;
