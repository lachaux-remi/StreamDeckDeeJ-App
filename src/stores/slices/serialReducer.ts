import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import { Log, Serial } from "@/types/SerialType";
import { DeeJSliderKey } from "@/types/SettingsType";

export const serialSlice = createSlice({
  name: "serial",
  initialState: {
    sessions: [] as Serial["sessions"],
    sliders: {} as Serial["sliders"],
    versions: {} as Serial["versions"],
    serialPortList: [] as Serial["serialPortList"],
    logs: [] as Serial["logs"]
  },
  reducers: {
    setSessions: (state, action: PayloadAction<Serial["sessions"]>) => {
      state.sessions = action.payload;
    },
    setSlidersVolume: (state, action: PayloadAction<Serial["sliders"]>) => {
      state.sliders = action.payload;
    },
    setSliderVolume: (state, action: PayloadAction<{ sliderKey: DeeJSliderKey; volume: number }>) => {
      state.sliders[action.payload.sliderKey] = action.payload.volume;
    },
    setSerialPortList: (state, action: PayloadAction<Serial["serialPortList"]>) => {
      state.serialPortList = action.payload;
    },
    setVersions: (state, action: PayloadAction<Serial["versions"]>) => {
      state.versions = action.payload;
    },
    setLogs: (state, action: PayloadAction<Serial["logs"]>) => {
      state.logs = action.payload;
    },
    setLog: (state, action: PayloadAction<Log>) => {
      state.logs.push(action.payload);
    }
  }
});

export const { setSessions, setSlidersVolume, setSliderVolume, setSerialPortList, setVersions, setLogs, setLog } =
  serialSlice.actions;

export default serialSlice.reducer;
