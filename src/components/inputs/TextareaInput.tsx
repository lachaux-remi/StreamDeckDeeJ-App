import { FormControl, TextField } from "@mui/material";
import { ChangeEvent } from "react";

export type TextareaInputProps = {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
};

const TextareaInput = (props: TextareaInputProps) => {
  const { label, value = "", onChange } = props;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <FormControl fullWidth>
      <TextField multiline minRows={4} label={label} value={value} onChange={handleChange} size="small" />
    </FormControl>
  );
};

export default TextareaInput;
