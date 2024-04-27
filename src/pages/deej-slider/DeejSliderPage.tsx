import {
  KeyboardArrowLeftRounded,
  KeyboardArrowRightRounded,
  KeyboardDoubleArrowLeftOutlined,
  KeyboardDoubleArrowRightOutlined,
  SaveRounded
} from "@mui/icons-material";
import { Stack } from "@mui/material";
import { ipcRenderer } from "electron";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

import SessionButton from "@/components/deej/session-button/SessionButton";
import SessionList from "@/components/deej/session-list/SessionList";
import Action from "@/components/page-actions/Action";
import { PageAction } from "@/components/page-actions/PageActions";
import Page from "@/components/page/Page";
import useSerial from "@/hooks/useSerial";
import useSettings from "@/hooks/useSettings";
import { setSessions } from "@/stores/slices/serialReducer";
import { updateSlider } from "@/stores/slices/settingsReducer";
import { DeeJSliderConfig, DeeJSliderKey } from "@/types/SettingsType";

import "./DeejSliderPage.scss";

const DeejSliderPage = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sessionsList = useSerial().getSessionsList();
  const sliderIndex = location.state.sliderIndex as DeeJSliderKey;
  const configStore = useSettings().getDeeJSliderConfig(sliderIndex);
  const [config, setConfig] = useState<DeeJSliderConfig>(configStore || []);
  const [session, setSession] = useState<string[]>(sessionsList);
  const notAssignedSelectedState = useState<string[]>([]);
  const assignedSelectedState = useState<string[]>([]);
  const [notAssignedSelected, setNotAssignedSelected] = notAssignedSelectedState;
  const [assignedSelected, setAssignedSelected] = assignedSelectedState;

  const handleSaveButtonConfig = async () => {
    dispatch(updateSlider({ sliderIndex, config }));
    await handleRefresh();
    return navigate("/deej");
  };

  const handleRefresh = async () => {
    await ipcRenderer.invoke("deej:session").then(sessions => {
      dispatch(setSessions(sessions));
      setSession(sessions);
    });
  };

  const handleAssignAll = () => {
    setConfig([...config, ...session]);
    setSession([]);
  };

  const handleAssign = () => {
    setSession(session.filter(item => !notAssignedSelected.includes(item)));
    setConfig([...config, ...notAssignedSelected]);
    setNotAssignedSelected([]);
  };

  const handleUnassign = () => {
    setConfig(config.filter(item => !assignedSelected.includes(item)));
    setSession([...session, ...assignedSelected]);
    setAssignedSelected([]);
  };

  const handleUnassignAll = () => {
    setSession([...session, ...config]);
    setConfig([]);
  };

  const actions: PageAction[] = [
    <Action onClick={handleSaveButtonConfig} icon={<SaveRounded />} variant="contained" key="save">
      Enregistrer
    </Action>
  ];

  return (
    <Page className="page__slider-config" title={`Configuration du slider n°${sliderIndex}`} actions={actions}>
      <SessionList items={session} title="Non attribué" state={notAssignedSelectedState} onRefresh={handleRefresh} />
      <Stack className="deej__buttons">
        <SessionButton icon={<KeyboardDoubleArrowRightOutlined />} onClick={handleAssignAll} />
        <SessionButton icon={<KeyboardArrowRightRounded />} onClick={handleAssign} />
        <SessionButton icon={<KeyboardArrowLeftRounded />} onClick={handleUnassign} />
        <SessionButton icon={<KeyboardDoubleArrowLeftOutlined />} onClick={handleUnassignAll} />
      </Stack>
      <SessionList items={config} title="Actuellement attribué" state={assignedSelectedState} />
    </Page>
  );
};

export default DeejSliderPage;
