import { VolumeUp } from "@mui/icons-material";
import { IconButton, Slider, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useContextMenu } from "@/hooks/useContextMenu";
import userSerial from "@/hooks/useSerial";
import { DeeJSliderKey } from "@/types/SettingsType";

type DeejSliderProps = {
  sliderIndex: DeeJSliderKey;
};

const DeejSlider = (props: DeejSliderProps) => {
  const { sliderIndex } = props;

  const navigate = useNavigate();
  const volume = userSerial().getSliderVolume(sliderIndex);

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
