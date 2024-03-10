import { SaveRounded } from "@mui/icons-material";
import { Divider, Paper } from "@mui/material";
import { ipcRenderer } from "electron";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import PasswordInput from "@/components/inputs/PasswordInput";
import ReloadSelectInput from "@/components/inputs/ReloadSelectInput";
import SelectInput from "@/components/inputs/SelectInput";
import TextInput from "@/components/inputs/TextInput";
import SwitchInput from "@/components/inputs/switch/SwitchInput";
import Action from "@/components/page-actions/Action";
import { PageAction } from "@/components/page-actions/PageActions";
import Page from "@/components/page/Page";
import useSettings from "@/hooks/useSettings";
import { updateConfig } from "@/stores/slices/settingsReducer";
import { InputOptionType } from "@/types/InputType";
import { type Settings } from "@/types/SettingsType";
import { objectToInputOptions as options } from "@/utils/ObjectUtil";

import "./Settings.scss";

type ApplicationVersions = {
  version: string;
  electron: string;
  node: string;
  platform: string;
  arch: string;
  chrome: string;
};

const SettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const configStore = useSettings().getConfig();
  const [config, setConfig] = useState<Settings>(configStore || []);
  const defaultSerialList: InputOptionType = { value: config.comPort, display: `⚠️ ${config.comPort} - déconnecté` };
  const [serialList, setSerialList] = useState<InputOptionType[]>([defaultSerialList]);
  const [versions, setVersions] = useState<ApplicationVersions | null>(null);
  const baudRateOptions: InputOptionType[] = [9600, 115200].map(baudRate => ({
    value: baudRate.toString(),
    display: baudRate.toString()
  }));

  useEffect(() => {
    (async () => {
      await handleRefreshSerialList();
      await getApplicationVersion();
    })();
  }, []);

  const handleRefreshSerialList = async () => {
    const list: string[] = await ipcRenderer.invoke("serial:list");

    const newSerialList = list.map(port => ({ value: port, display: port }));
    if (!newSerialList.some(port => port.value === config.comPort)) {
      newSerialList.push(defaultSerialList);
    }

    setSerialList(newSerialList);
  };

  const getApplicationVersion = async () => {
    const versions = await ipcRenderer.invoke("getVersions");
    setVersions(versions);
  };

  const handleSaveButtonConfig = () => {
    dispatch(updateConfig(config));
    return navigate("/");
  };

  const actions: PageAction[] = [
    <Action onClick={handleSaveButtonConfig} icon={<SaveRounded />} variant="contained" key="save">
      Enregistrer
    </Action>
  ];

  return (
    <Page className="page__settings" title="Paramètres" actions={actions}>
      <div className="settings__config">
        <Paper className="config__form" sx={{ padding: 2 }} elevation={3}>
          <h2>Arduino</h2>
          <div className="config__inputs">
            <ReloadSelectInput
              label="Port de communication"
              value={config.comPort}
              options={options(serialList)}
              onChange={value => setConfig({ ...config, comPort: value })}
              onReload={handleRefreshSerialList}
            />
            <SelectInput
              label="Vitesse de communication"
              value={config.baudRate.toString()}
              options={options(baudRateOptions)}
              onChange={value => setConfig({ ...config, baudRate: parseInt(value) })}
            />
            <SwitchInput
              label="Inverser les valeurs des curseurs"
              helperText="Inverse les valeurs des curseurs retourné par l'Arduino (0-100 devient 100-0)."
              value={config.invertSliders || false}
              onChange={value => setConfig({ ...config, invertSliders: value })}
            />
          </div>
        </Paper>

        <Paper className="config__form" sx={{ padding: 2 }} elevation={3}>
          <h2>Compte Tapo</h2>
          <div className="config__inputs">
            <TextInput
              label="Utilisateur"
              value={config.tapo?.username || ""}
              onChange={value => setConfig({ ...config, tapo: { ...config.tapo, username: value } })}
            />
            <PasswordInput
              label="Mot de passe"
              value={config.tapo?.password || ""}
              onChange={value => setConfig({ ...config, tapo: { ...config.tapo, password: value } })}
            />
          </div>
        </Paper>

        <Paper className="config__form" sx={{ padding: 2 }} elevation={3}>
          <h2>Configuration</h2>
          <div className="config__inputs">
            <SwitchInput
              label="Ouvrir StreamDeck Deej"
              helperText="Ouvre StreamDeck Deej au démarrage de l'ordinateur."
              value={config.runOnStartup || false}
              onChange={value => setConfig({ ...config, runOnStartup: value })}
            />
            <SwitchInput
              label="Démarrer en arrière-plan"
              helperText="StreamDeck Deej se lance en arrière-plan."
              value={config.runInBackground || false}
              onChange={value => setConfig({ ...config, runInBackground: value })}
            />
            <SwitchInput
              label="Minimiser dans la barre des tâches"
              helperText="Cliquer sur Fermer pour reduire dans la barre des tâches."
              value={config.closeToTray || false}
              onChange={value => setConfig({ ...config, closeToTray: value })}
            />
            <SwitchInput
              label="Outils de développement"
              helperText="Affiche les outils de développement de l'application au lancement."
              value={config.devTools || false}
              onChange={value => setConfig({ ...config, devTools: value })}
            />
          </div>
        </Paper>

        <Paper className="config__abort" sx={{ padding: 2 }} elevation={3}>
          <h2>À propos</h2>
          <div className="abort__infos">
            <div className="infos__detail">
              <strong>StreamDeck DeeJ</strong> est un mélangeur de volume mais aussi un Stream Deck pour les PC. Il se
              compose d'un client de bureau léger écrit en JavaScript avec Electron et d'une configuration matérielle
              basée sur Arduino simple et peu coûteuse à construire.
            </div>

            <div className="infos__detail">
              Développé par{" "}
              <a href="//github.com/lachaux-remi/StreamDeckDeeJ" target="_blank">
                Rémi LACHAUX
              </a>
            </div>
          </div>

          <Divider sx={{ marginY: 2 }} />

          <div className="abort__versions">
            <div className="version__info">
              Node: <strong>{versions?.node || "N/D"}</strong>
            </div>
            <div className="version__info">
              Electron: <strong>{versions?.electron || "N/D"}</strong>
            </div>
            <div className="version__info">
              Chrome: <strong>{versions?.chrome || "N/D"}</strong>
            </div>
            <div className="version__info">
              Version: <strong>{versions?.version || "N/D"}</strong>
            </div>
            <div className="version__info">
              Plateforme: <strong>{versions?.platform || "N/D"}</strong>
            </div>
            <div className="version__info">
              Architecture: <strong>{versions?.arch || "N/D"}</strong>
            </div>
          </div>
        </Paper>
      </div>
    </Page>
  );
};

export default SettingsPage;
