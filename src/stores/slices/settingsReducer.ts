import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import {
  DeeJSliderConfig,
  DeeJSliderKey,
  Settings,
  StreamdeckInputConfig,
  StreamdeckInputKey
} from "@/types/SettingsType";

export const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    streamdeck: {},
    deej: {}
  } as Settings,
  reducers: {
    hydrate: (state, action: PayloadAction<Settings>) => {
      return action.payload;
    },
    updateConfig: (state, action: PayloadAction<Settings>) => {
      return { ...state, ...action.payload };
    },
    updateSlider: (state, action: PayloadAction<{ sliderIndex: DeeJSliderKey; config: DeeJSliderConfig }>) => {
      state.deej[action.payload.sliderIndex] = action.payload.config;
    },
    updateStreamdeckButton: (
      state,
      action: PayloadAction<{ inputIndex: StreamdeckInputKey; config: StreamdeckInputConfig }>
    ) => {
      state.streamdeck[action.payload.inputIndex] = action.payload.config;
    },
    moveStreamdeckButton: (
      state,
      action: PayloadAction<
        [
          { inputIndex: StreamdeckInputKey; config: StreamdeckInputConfig | undefined },
          { inputIndex: StreamdeckInputKey; config: StreamdeckInputConfig | undefined }
        ]
      >
    ) => {
      const [from, to] = action.payload;

      if (from.config !== undefined) {
        state.streamdeck[from.inputIndex] = from.config;
      } else {
        delete state.streamdeck[from.inputIndex];
      }

      if (to.config !== undefined) {
        state.streamdeck[to.inputIndex] = to.config;
      } else {
        delete state.streamdeck[to.inputIndex];
      }
    },
    removeStreamdeckButton: (state, action: PayloadAction<StreamdeckInputKey>) => {
      delete state.streamdeck[action.payload];
    }
  }
});

export const {
  hydrate,
  updateConfig,
  updateSlider,
  updateStreamdeckButton,
  moveStreamdeckButton,
  removeStreamdeckButton
} = settingsSlice.actions;

export default settingsSlice.reducer;
