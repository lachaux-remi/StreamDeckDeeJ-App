import { RefreshOutlined } from "@mui/icons-material";
import { List, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import { Dispatch, SetStateAction } from "react";

import "./SessionList.scss";

type SessionListType = {
  title: string;
  items: string[];
  state: [string[], Dispatch<SetStateAction<string[]>>];
  onRefresh?: () => void;
};

const SessionList = (props: SessionListType) => {
  const {
    title,
    items,
    state: [selected, setSelected],
    onRefresh
  } = props;

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
        {onRefresh && <RefreshOutlined className="session__refresh" onClick={onRefresh} />}
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
