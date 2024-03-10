import StreamdeckImage from "@/components/streamdeck/image/StreamdeckImage";
import KeyUsageEnum from "@/enums/KeyUsageEnum";
import useSettings from "@/hooks/useSettings";
import { StreamdeckInputKey } from "@/types/SettingsType";

import "./StreamdeckAction.scss";

type StreamdeckActionProps = {
  inputIndex: StreamdeckInputKey;
  inputType: KeyUsageEnum;
};

const StreamdeckAction = (props: StreamdeckActionProps) => {
  const { inputType, inputIndex } = props;
  const config = useSettings().getStreamdeckInputConfig(inputIndex)?.[inputType];

  if (config === undefined || config.icon === undefined) {
    return null;
  }

  return <StreamdeckImage className="streamdeck__action" datatype={inputType} image={config.icon} />;
};

export default StreamdeckAction;
