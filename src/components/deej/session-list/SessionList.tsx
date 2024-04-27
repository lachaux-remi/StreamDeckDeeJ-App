import { CheckOutlined, RefreshOutlined } from "@mui/icons-material";
import { CircularProgress, List, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

import "./SessionList.scss";

type SessionListType = {
  title: string;
  items: string[];
  state: [string[], Dispatch<SetStateAction<string[]>>];
  onRefresh?: () => Promise<void>;
};

const SessionList = (props: SessionListType) => {
  const {
    title,
    items,
    state: [selected, setSelected],
    onRefresh
  } = props;
  const [waitingState, setWaitingState] = useState<"wait" | "completed" | "none">("none");

  useEffect(() => {
    if (waitingState === "completed") {
      setTimeout(() => {
        setWaitingState("none");
      }, 1000);
    }
  }, [waitingState]);

  const handleReload = async () => {
    if (onRefresh) {
      setWaitingState("wait");
      await onRefresh();
      setWaitingState("completed");
    }
  };

  const handleSelectItem = (sessionName: string) => {
    if (!isSelected(sessionName)) {
      setSelected([...selected, sessionName]);
    } else {
      setSelected(selected.filter(item => item !== sessionName));
    }
  };

  const isSelected = (sessionName: string) => {
    return selected.includes(sessionName);
  };

  return (
    <div className="deej__session-list">
      <div className="session__title">
        <Typography>{title}</Typography>
        {onRefresh && (
          <span className="session__refresh" onClick={handleReload}>
            {waitingState == "none" ? (
              <RefreshOutlined />
            ) : waitingState == "wait" ? (
              <CircularProgress size="24px" />
            ) : (
              <CheckOutlined color="success" />
            )}
          </span>
        )}
      </div>
      <Paper className="session__list">
        <List dense component="div">
          {items.map((item, index) => (
            <ListItemButton key={index} onClick={() => handleSelectItem(item)} selected={isSelected(item)}>
              <ListItemText primary={item} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </div>
  );
};

export default SessionList;
