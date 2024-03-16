import { Theme } from "@mui/material";

export const rootVariables = (theme: Theme) => {
  return {
    ":root": {
      ...["common", "primary", "secondary", "error", "warning", "info", "success", "grey"]
        .map(key =>
          Object.keys(theme.palette[key as keyof typeof theme.palette])
            .map(variant => ({
              [`--${key}-${variant}`]:
                theme.palette[key as keyof typeof theme.palette][
                  variant as keyof (typeof theme.palette)[keyof typeof theme.palette]
                ]
            }))
            .reduce((acc, cur) => ({ ...acc, ...cur }))
        )
        .reduce((acc, cur) => ({ ...acc, ...cur })),
      "--border-color": `rgba(255, 255, 255, 0.23)`,
      "--border-radius": `${theme.shape.borderRadius}px`
    }
  };
};

export const scrollbar = (theme: Theme) => {
  return {
    "*::-webkit-scrollbar-track": {
      backgroundColor: "transparent"
    },
    "*::-webkit-scrollbar": {
      width: "5px",
      backgroundColor: "transparent"
    },
    "*::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.grey[400]
    }
  };
};
