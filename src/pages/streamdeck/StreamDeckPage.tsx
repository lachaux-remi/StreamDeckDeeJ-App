import { ipcRenderer } from "electron";
import React, { useEffect, useState } from "react";

import Page from "@/components/page/Page";
import StreamdeckButton from "@/components/streamdeck/button/StreamdeckButton";
import StreamdeckPanel from "@/components/streamdeck/panel/StreamdeckPanel";
import { StreamdeckInputKey } from "@/types/SettingsType";
import { range } from "@/utils/ObjectUtil";

import "./StreamDeck.scss";

const StreamDeckPage = () => {
  const [data, setData] = useState<{ [inputIndex: string]: Record<string, string> }>({});

  useEffect(() => {
    ipcRenderer.on("streamdeck-key-pressed", (_, inputIndex: StreamdeckInputKey, newData: Record<string, string>) => {
      setData({ ...data, [inputIndex]: newData });
    });

    return () => {
      ipcRenderer.removeAllListeners("streamdeck-key-pressed");
    };
  }, []);

  return (
    <Page className="page__streamdeck">
      <StreamdeckPanel>
        {range(0, 15).map(index => {
          return <StreamdeckButton key={`deck-input-${index}`} inputIndex={index.toString()} data={data[index]} />;
        })}
      </StreamdeckPanel>
    </Page>
  );
};

export default StreamDeckPage;
