import { Visibility, VisibilityOff } from "@mui/icons-material";
import { FormControl, IconButton, InputAdornment, TextField } from "@mui/material";
import { ChangeEvent, MouseEvent, useState } from "react";

export type PasswordInputProps = {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
};

const PasswordInput = (props: PasswordInputProps) => {
  const { label, value = "", onChange } = props;
  const [showPassword, setShowPassword] = useState(false);

  const handleClickShow = () => setShowPassword(show => !show);

  const handleMouse = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <FormControl fullWidth>
      <TextField
        type={showPassword ? "text" : "password"}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleClickShow}
                onMouseDown={handleMouse}
                onMouseUp={handleMouse}
                edge="end"
                size="small"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          )
        }}
        label={label}
        value={value}
        onChange={handleChange}
        size="small"
      />
    </FormControl>
  );
};

export default PasswordInput;
