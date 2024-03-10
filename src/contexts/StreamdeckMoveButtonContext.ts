import { createContext } from "react";

import { StreamdeckInputKey } from "@/types/SettingsType";

export type ContextStreamdeckMoveButtonType = [
  StreamdeckInputKey | null,
  (inputIndex: StreamdeckInputKey | null) => void
];

const StreamdeckMoveButtonContext = createContext<ContextStreamdeckMoveButtonType>([null, () => {}]);

export default StreamdeckMoveButtonContext;
