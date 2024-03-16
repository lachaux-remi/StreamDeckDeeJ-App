import { LogoDevRounded } from "@mui/icons-material";
import { Paper } from "@mui/material";
import clsx from "clsx";
import { ipcRenderer } from "electron";

import Action from "@/components/page-actions/Action";
import { PageAction } from "@/components/page-actions/PageActions";
import Page from "@/components/page/Page";
import useSerial from "@/hooks/useSerial";
import { Log } from "@/types/SerialType";

import "./ConsolePage.scss";

const ConsolePage = () => {
  const logs: Log[] = useSerial().getLogs();

  const openDevToolsHandle = () => {
    ipcRenderer.send("open-devtools");
  };

  const actions: PageAction[] = [
    <Action onClick={openDevToolsHandle} icon={<LogoDevRounded />} variant="contained" key="save">
      Ouvrir les devtools
    </Action>
  ];

  return (
    <Page className="page__console" title="Console" actions={actions}>
      <Paper className="console__content" elevation={3}>
        <div className="content__lines">
          {logs.map((log, index) => (
            <div key={index} className="lines__line">
              <div className="line__service">{log.service}</div>
              <div className={clsx(["line__infos", log.level])}>
                <div className="info__level">[{log.level.toUpperCase()}]</div>
                <div className="info__messages">
                  {log.args.map((arg, argIndex) => {
                    if (typeof arg === "object" && arg.stack) {
                      return (
                        <div key={index + "-" + argIndex} className="messages__message-stack">
                          {arg.stack}
                        </div>
                      );
                    } else if (typeof arg === "string") {
                      return (
                        <div key={index + "-" + argIndex} className="messages__message">
                          {arg}
                        </div>
                      );
                    } else {
                      console.log(arg);
                    }
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Paper>
    </Page>
  );
};

export default ConsolePage;
