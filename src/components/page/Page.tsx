import { ReactNode, useEffect, useRef } from "react";

import PageActions, { PageAction } from "@/components/page-actions/PageActions";

import "./Page.scss";

type MainProps = {
  title?: string;
  className?: string;
  actions?: PageAction[];
  children: ReactNode;
};

const Page = (props: MainProps) => {
  const { title, className, actions = [], children } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      if (ref.current.scrollHeight > ref.current.clientHeight) {
        ref.current.classList.add("scrollable");
      }
    }
  }, [ref]);

  const titleElement = title ? (
    <div className="main__header">
      <h1 className="main__title">{title}</h1>
      <PageActions>{actions}</PageActions>
    </div>
  ) : null;

  return (
    <div className={["main", className].join(" ")}>
      {titleElement}
      <div className="main__content" ref={ref}>
        {children}
      </div>
    </div>
  );
};

export default Page;
