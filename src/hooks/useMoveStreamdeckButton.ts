import { useContext } from "react";
import { useDispatch } from "react-redux";

import StreamdeckMoveButtonContext from "@/contexts/StreamdeckMoveButtonContext";
import useSettings from "@/hooks/useSettings";
import { moveStreamdeckButton } from "@/stores/slices/settingsReducer";
import { StreamdeckInputKey } from "@/types/SettingsType";

const useMoveStreamdeckButton = () => {
  const [currentMovingIndex, setCurrentMovingIndex] = useContext(StreamdeckMoveButtonContext);
  const dispatch = useDispatch();
  const settings = useSettings();

  const isCurrentMovingButton = (inputIndex: StreamdeckInputKey): boolean => {
    return currentMovingIndex === inputIndex;
  };

  const hasCurrentMovingButton = (): boolean => {
    return currentMovingIndex !== null;
  };

  const startMoveButton = (inputIndex: StreamdeckInputKey) => {
    setCurrentMovingIndex(inputIndex);
  };

  const stopMoveButton = () => {
    setCurrentMovingIndex(null);
  };

  const moveButton = (destIndex: StreamdeckInputKey) => {
    const inputIndex = currentMovingIndex!;

    const fromMoveConfig = settings.getStreamdeckInputConfig(destIndex) || undefined;
    const toMoveConfig = settings.getStreamdeckInputConfig(inputIndex) || undefined;

    dispatch(
      moveStreamdeckButton([
        { inputIndex: inputIndex, config: fromMoveConfig },
        {
          inputIndex: destIndex,
          config: toMoveConfig
        }
      ])
    );

    stopMoveButton();
  };

  return {
    startMoveButton,
    stopMoveButton,
    hasCurrentMovingButton,
    isCurrentMovingButton,
    moveButton
  };
};

export default useMoveStreamdeckButton;
