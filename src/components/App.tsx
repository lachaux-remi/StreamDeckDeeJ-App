import { CssBaseline, GlobalStyles, ThemeProvider, createTheme, useMediaQuery } from "@mui/material";
import { useMemo } from "react";
import { Provider } from "react-redux";

import DefaultRouter from "@/routers/DefaultRouter";
import ElectronHydrate from "@/stores/hydrator/ElectronHydrate";
import { store } from "@/stores/store";
import { rootVariables, scrollbar } from "@/utils/CssUtil";

import "./App.scss";

const App = () => {
  const useDarkColors = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(() => {
    return createTheme({
      palette: {
        mode: useDarkColors ? "dark" : "light",
        primary: {
          main: "#4C73E6"
        },
        secondary: {
          main: "#8C55E9"
        }
      }
    });
  }, [useDarkColors]);

  const style = {
    ...rootVariables(theme),
    ...scrollbar(theme)
  };

  return (
    <Provider store={store}>
      <ElectronHydrate>
        <ThemeProvider theme={theme}>
          <GlobalStyles styles={style} />
          <CssBaseline />
          <DefaultRouter />
        </ThemeProvider>
      </ElectronHydrate>
    </Provider>
  );
};

export default App;
