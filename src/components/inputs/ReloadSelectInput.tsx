import { CheckOutlined, RefreshOutlined } from "@mui/icons-material";
import { CircularProgress, FormControl, IconButton, MenuItem, Stack, TextField, Tooltip } from "@mui/material";
import { ChangeEvent, useEffect, useState } from "react";

export type ReloadSelectInputProps = {
  label: string;
  value?: string;
  options: Record<string, string>;
  onChange?: (value: string) => void;
  onReload?: () => Promise<void>;
};

const ReloadSelectInput = (props: ReloadSelectInputProps) => {
  const { label, value = "", options, onChange, onReload } = props;
  const [waitingState, setWaitingState] = useState<"wait" | "completed" | "none">("none");

  useEffect(() => {
    if (waitingState === "completed") {
      setTimeout(() => {
        setWaitingState("none");
      }, 1000);
    }
  }, [waitingState]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value as string);
    }
  };

  const handleReload = async () => {
    if (onReload) {
      setWaitingState("wait");
      await onReload();
      setWaitingState("completed");
    }
  };

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <FormControl fullWidth>
        <TextField select label={label} value={value} onChange={handleChange} size="small">
          {Object.keys(options).map(key => (
            <MenuItem key={key} value={key}>
              {options[key]}
            </MenuItem>
          ))}
        </TextField>
      </FormControl>

      <Tooltip title={"Recharger la liste"} describeChild placement="right">
        <IconButton onClick={handleReload} size="small">
          {waitingState == "none" ? (
            <RefreshOutlined />
          ) : waitingState == "wait" ? (
            <CircularProgress size="24px" />
          ) : (
            <CheckOutlined color="success" />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

export default ReloadSelectInput;
