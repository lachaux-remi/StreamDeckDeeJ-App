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
    "*::-webkit-scrollbar": {
      backgroundColor: theme.palette.background.default
    },
    "*::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.grey[500],
      borderLeftWidth: "12px",
      borderStyle: "solid",
      borderColor: theme.palette.background.default
    },
    "*::-webkit-scrollbar-thumb:hover": {
      backgroundColor: theme.palette.grey[400]
    }
  };
};
