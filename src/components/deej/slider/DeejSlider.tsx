import { VolumeUp } from "@mui/icons-material";
import { IconButton, Slider, Typography } from "@mui/material";
import { IpcRendererEvent, ipcRenderer } from "electron";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { useContextMenu } from "@/hooks/useContextMenu";
import userSerial from "@/hooks/useSerial";
import { setSliderVolume } from "@/stores/slices/serialReducer";
import { DeeJSliderKey } from "@/types/SettingsType";

type DeejSliderProps = {
  sliderIndex: DeeJSliderKey;
};

const DeejSlider = (props: DeejSliderProps) => {
  const { sliderIndex } = props;

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const volume = userSerial().getSliderVolume(sliderIndex);

  useEffect(() => {
    const setNewValue = (_: IpcRendererEvent, newValue: number) => {
      dispatch(setSliderVolume({ sliderIndex, volume: newValue }));
    };

    ipcRenderer.on(`deej:${sliderIndex}`, setNewValue);
    (async () =>
      dispatch(
        setSliderVolume({
          sliderIndex,
          volume: await ipcRenderer.invoke(`deej:slider`, sliderIndex)
        })
      ))();

    return () => {
      ipcRenderer.removeListener(`deej:${sliderIndex}`, setNewValue);
    };
  }, []);

  const contextMenuItems = [
    {
      caption: "Modifier",
      onClick: () => navigate("/deej/config", { state: { sliderIndex } })
    }
  ];
  const { contextMenu, handleContextMenu } = useContextMenu(contextMenuItems);

  return (
    <div className="deej__slider" onContextMenu={handleContextMenu} title={`Slider ${sliderIndex}`}>
      <Typography alignItems="center">{volume}%</Typography>
      <Slider disabled value={volume} orientation="vertical" />
      <IconButton>
        <VolumeUp />
      </IconButton>
      {contextMenu}
    </div>
  );
};

export default DeejSlider;
