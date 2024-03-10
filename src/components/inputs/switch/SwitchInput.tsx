import { FormControl, FormControlLabel, FormHelperText, Stack, Switch } from "@mui/material";
import { ChangeEvent } from "react";

import "./SwitchInput.scss";

export type SwitchInputProps = {
  label: string;
  helperText: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
};

const SwitchInput = (props: SwitchInputProps) => {
  const { label, helperText, value = false, onChange } = props;

  const randomId = Math.random().toString(36).substring(7);

  const handleChange = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
    if (onChange) {
      onChange(checked);
    }
  };

  return (
    <FormControl className="switch-input" fullWidth>
      <FormControlLabel
        control={<Switch id={randomId} onChange={handleChange} checked={value} />}
        label={
          <Stack justifyContent="center" spacing={1}>
            {label}
            <FormHelperText>{helperText}</FormHelperText>
          </Stack>
        }
        labelPlacement="start"
      />
    </FormControl>
  );
};

export default SwitchInput;
