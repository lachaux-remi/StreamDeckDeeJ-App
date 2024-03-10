import logo from "@/assets/logo.svg";

import "./Titlebar.scss";

const Titlebar = () => {
  return (
    <div className="titlebar">
      <img src={logo} alt="streamdeck deej logo" />
      <span>StreamDeck DeeJ</span>
    </div>
  );
};

export default Titlebar;
