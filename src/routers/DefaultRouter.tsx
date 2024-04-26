import { HashRouter, Route, Routes } from "react-router-dom";

import DefaultLayout from "@/layouts/default/DefaultLayout";
import ConsolePage from "@/pages/console/ConsolePage";
import DeejSliderPage from "@/pages/deej-slider/DeejSliderPage";
import DeeJPage from "@/pages/deej/DeeJPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import StreamdeckButtonPage from "@/pages/streamdeck-button/StreamdeckButtonPage";
import StreamDeckPage from "@/pages/streamdeck/StreamDeckPage";

const DefaultRouter = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DefaultLayout />}>
          <Route index element={<StreamDeckPage />} />
          <Route path="streamdeck">
            <Route index element={<StreamDeckPage />} />
            <Route path="config" element={<StreamdeckButtonPage />} />
          </Route>
          <Route path="deej">
            <Route index element={<DeeJPage />} />
            <Route path="config" element={<DeejSliderPage />} />
          </Route>
          <Route path="console" element={<ConsolePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default DefaultRouter;
