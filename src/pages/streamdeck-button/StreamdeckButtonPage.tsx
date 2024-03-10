import { SaveRounded } from "@mui/icons-material";
import { Paper } from "@mui/material";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

import StreamdeckImageInput from "@/components/inputs/image/StreamdeckImageInput";
import Action from "@/components/page-actions/Action";
import { PageAction } from "@/components/page-actions/PageActions";
import Page from "@/components/page/Page";
import KeyUsageEnum from "@/enums/KeyUsageEnum";
import useSettings from "@/hooks/useSettings";
import ModuleInput from "@/pages/streamdeck-button/module-input/ModuleInput";
import { updateStreamdeckButton } from "@/stores/slices/settingsReducer";
import { StreamdeckInputConfig, StreamdeckInputKey, StreamdeckKey } from "@/types/SettingsType";

import "./StreamdeckButton.scss";

const StreamdeckButtonPage = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const inputIndex = location.state.inputIndex as StreamdeckInputKey;
  const configStore = useSettings().getStreamdeckInputConfig(inputIndex);
  const [config, setConfig] = useState<StreamdeckInputConfig>(configStore || {});

  const handleUpdateConfig = (type: KeyUsageEnum, value: Partial<StreamdeckKey>) => {
    if (!value.module) {
      setConfig({ ...config, [type]: undefined });
      return;
    }

    setConfig({ ...config, [type]: { ...(config[type] || {}), ...value } });
  };

  const handleSetIconForType = (type: KeyUsageEnum, icon: StreamdeckKey["icon"]) => {
    setConfig({ ...config, [type]: { ...(config[type] || {}), icon } });
  };

  const handleSaveButtonConfig = () => {
    dispatch(updateStreamdeckButton({ inputIndex, config }));
    return navigate("/streamdeck");
  };

  const actions: PageAction[] = [
    <Action onClick={handleSaveButtonConfig} icon={<SaveRounded />} variant="contained" key="save">
      Enregistrer
    </Action>
  ];

  return (
    <Page className="page__input-config" title={`Configuration du bouton n°${inputIndex}`} actions={actions}>
      <div className="input-config">
        <Paper className="input-config__press" sx={{ padding: 2 }} elevation={3}>
          <h2>Pression courte</h2>
          <div className="input-config__form">
            <ModuleInput
              type={KeyUsageEnum.Pressed}
              inputIndex={inputIndex}
              onChange={values => handleUpdateConfig(KeyUsageEnum.Pressed, values)}
            />
          </div>
        </Paper>

        <Paper className="input-config__hold" sx={{ padding: 2 }} elevation={3}>
          <h2>Pression longue</h2>
          <div className="input-config__form">
            <ModuleInput
              type={KeyUsageEnum.Hold}
              inputIndex={inputIndex}
              onChange={values => handleUpdateConfig(KeyUsageEnum.Hold, values)}
            />
          </div>
        </Paper>

        <Paper className="input-config__icons" sx={{ padding: 2 }} elevation={3}>
          <h2>Images</h2>
          <div className="icons__block">
            <StreamdeckImageInput
              label="Principal"
              value={config.icon}
              onChange={icon => setConfig({ ...config, icon })}
            />
            {config[KeyUsageEnum.Pressed] && (
              <StreamdeckImageInput
                label="Pression courte"
                value={config[KeyUsageEnum.Pressed].icon}
                onChange={icon => handleSetIconForType(KeyUsageEnum.Pressed, icon)}
              />
            )}
            {config[KeyUsageEnum.Hold] && (
              <StreamdeckImageInput
                label="Pression longue"
                value={config[KeyUsageEnum.Hold].icon}
                onChange={icon => handleSetIconForType(KeyUsageEnum.Hold, icon)}
              />
            )}
          </div>
        </Paper>
      </div>
    </Page>
  );
};

export default StreamdeckButtonPage;
