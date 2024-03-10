import { Paper } from "@mui/material";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import StreamdeckAction from "@/components/streamdeck/action/StreamdeckAction";
import StreamdeckImage from "@/components/streamdeck/image/StreamdeckImage";
import KeyUsageEnum from "@/enums/KeyUsageEnum";
import { useContextMenu } from "@/hooks/useContextMenu";
import useMoveStreamdeckButton from "@/hooks/useMoveStreamdeckButton";
import useSettings from "@/hooks/useSettings";
import { removeStreamdeckButton } from "@/stores/slices/settingsReducer";
import { StreamdeckInputKey } from "@/types/SettingsType";

import "./StreamdeckButton.scss";

type StreamdeckButtonProps = {
  inputIndex: StreamdeckInputKey;
  data?: Record<string, string>;
};

const StreamdeckButton = (props: StreamdeckButtonProps) => {
  const { inputIndex } = props;

  const config = useSettings().getStreamdeckInputConfig(inputIndex);
  const { isCurrentMovingButton, hasCurrentMovingButton, startMoveButton, stopMoveButton, moveButton } =
    useMoveStreamdeckButton();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const contextMenuItems = [
    {
      caption: config ? "Modifier" : "Créer",
      onClick: () => navigate("/streamdeck/config", { state: { inputIndex } })
    }
  ];
  if (config) {
    contextMenuItems.push(
      {
        caption: isCurrentMovingButton(inputIndex) ? "Annuler le déplacement" : "Déplacer",
        onClick: () => (isCurrentMovingButton(inputIndex) ? stopMoveButton() : startMoveButton(inputIndex))
      },
      {
        caption: "Supprimer",
        onClick: () => dispatch(removeStreamdeckButton(inputIndex))
      }
    );
  }
  const { contextMenu, handleContextMenu } = useContextMenu(contextMenuItems);

  const handleClick = () => {
    if (hasCurrentMovingButton()) {
      if (isCurrentMovingButton(inputIndex)) {
        stopMoveButton();
      }

      moveButton(inputIndex);
    }
  };

  const contentRenderer = () => {
    if (!config) {
      return null;
    }

    return (
      <>
        <StreamdeckImage image={config.icon} />
        <StreamdeckAction inputType={KeyUsageEnum.Hold} inputIndex={inputIndex} />
        <StreamdeckAction inputType={KeyUsageEnum.Pressed} inputIndex={inputIndex} />
      </>
    );
  };

  return (
    <Paper
      className="streamdeck__button"
      elevation={3}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={`Bouton ${inputIndex}`}
    >
      {contentRenderer()}
      {contextMenu}
    </Paper>
  );
};

export default StreamdeckButton;
