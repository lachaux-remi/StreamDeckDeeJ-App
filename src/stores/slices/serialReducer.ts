import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import { ApplicationVersions, Serial } from "@/types/SerialType";
import { DeeJSliderKey } from "@/types/SettingsType";

export const serialSlice = createSlice({
  name: "serial",
  initialState: {
    sliders: {} as Serial["sliders"],
    versions: {} as Serial["versions"],
    serialPortList: [] as Serial["serialPortList"]
  },
  reducers: {
    setSlidersVolume: (state, action: PayloadAction<Serial["sliders"]>) => {
      state.sliders = action.payload;
    },
    setSliderVolume: (state, action: PayloadAction<{ sliderKey: DeeJSliderKey; volume: number }>) => {
      state.sliders[action.payload.sliderKey] = action.payload.volume;
    },
    setSerialPortList: (state, action: PayloadAction<Serial["serialPortList"]>) => {
      state.serialPortList = action.payload;
    },
    setVersions: (state, action: PayloadAction<ApplicationVersions>) => {
      state.versions = action.payload;
    }
  }
});

export const { setSlidersVolume, setSliderVolume, setSerialPortList, setVersions } = serialSlice.actions;

export default serialSlice.reducer;
