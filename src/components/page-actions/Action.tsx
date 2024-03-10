import { Button, ButtonProps } from "@mui/material";
import { ReactNode } from "react";

type ActionProps = {
  key: string | number;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
  color?: ButtonProps["color"];
  icon: ReactNode;
  children: ReactNode;
};

const Action = (props: ActionProps) => {
  const { onClick, variant, color, icon, children } = props;
  return (
    <Button onClick={onClick} size="small" variant={variant || "outlined"} color={color || "primary"} startIcon={icon}>
      {children}
    </Button>
  );
};

export default Action;
