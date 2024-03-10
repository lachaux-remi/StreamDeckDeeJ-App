import { Button } from "@mui/material";
import { ReactNode } from "react";

type SessionButtonProps = {
  icon: ReactNode;
  onClick?: () => void;
};

const SessionButton = (props: SessionButtonProps) => {
  const { icon, onClick } = props;

  return (
    <Button sx={{ my: 0.5 }} variant="contained" size="small" color="secondary" onClick={onClick}>
      {icon}
    </Button>
  );
};

export default SessionButton;
