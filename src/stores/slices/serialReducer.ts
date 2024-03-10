import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import { Serial } from "@/types/SerialType";
import { DeeJSliderKey } from "@/types/SettingsType";

export const serialSlice = createSlice({
  name: "serial",
  initialState: {
    sliders: {}
  } as Serial,
  reducers: {
    setSliderVolume: (state, action: PayloadAction<{ sliderIndex: DeeJSliderKey; volume: number }>) => {
      state.sliders[action.payload.sliderIndex] = Math.round(action.payload.volume * 100);
    }
  }
});

export const { setSliderVolume } = serialSlice.actions;

export default serialSlice.reducer;
