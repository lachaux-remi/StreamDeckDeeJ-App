import React, { useState } from "react";

import StreamdeckMoveButtonContext from "@/contexts/StreamdeckMoveButtonContext";
import { StreamdeckInputKey } from "@/types/SettingsType";

type StreamdeckPanelType = {
  children: React.ReactNode;
};

const StreamdeckPanel = (props: StreamdeckPanelType) => {
  const { children } = props;

  const movingButtonState = useState<StreamdeckInputKey | null>(null);

  return (
    <StreamdeckMoveButtonContext.Provider value={movingButtonState}>
      <div className="streamdeck" data-moving={!!movingButtonState[0]}>
        {children}
      </div>
    </StreamdeckMoveButtonContext.Provider>
  );
};

export default StreamdeckPanel;
