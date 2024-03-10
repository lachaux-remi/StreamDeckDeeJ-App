import { configureStore } from "@reduxjs/toolkit";

import electronConfigMiddleware from "@/stores/middlewares/electronConfigMiddleware";
import serialSlice from "@/stores/slices/serialReducer";
import settingsReducer from "@/stores/slices/settingsReducer";

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
    serial: serialSlice
  },
  middleware: getDefaultMiddleware => {
    return getDefaultMiddleware({
      serializableCheck: false,
      thunk: true
    }).concat(electronConfigMiddleware);
  }
});
