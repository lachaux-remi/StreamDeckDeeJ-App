import { FormControl, MenuItem, TextField } from "@mui/material";
import { ChangeEvent } from "react";

export type SelectInputProps = {
  label: string;
  value?: string;
  options: Record<string, string>;
  onChange?: (value: string) => void;
};

const SelectInput = (props: SelectInputProps) => {
  const { label, value = "", options, onChange } = props;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value as string);
    }
  };

  return (
    <FormControl fullWidth>
      <TextField select label={label} value={value} onChange={handleChange} size="small">
        {Object.keys(options).map(key => (
          <MenuItem key={key} value={key}>
            {options[key]}
          </MenuItem>
        ))}
      </TextField>
    </FormControl>
  );
};

export default SelectInput;
