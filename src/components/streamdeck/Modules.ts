import InputFormType from "@/enums/InputFormType";
import ModuleEnum from "@/enums/ModuleEnum";
import { Modules } from "@/types/ModuleType";

export const modules: Modules[] = [
  {
    display: "Macro",
    value: ModuleEnum.Macro,
    inputs: [{ name: "Code Arduino", type: InputFormType.Text }]
  },
  {
    display: "Led infrarouge",
    value: ModuleEnum.Ir,
    inputs: [{ name: "Code infrarouge", type: InputFormType.Textarea }]
  },
  {
    display: "OctoPrint LED",
    value: ModuleEnum.OctopiLed,
    inputs: [
      { name: "Adresse IP", type: InputFormType.Text },
      {
        name: "Commande",
        type: InputFormType.Select,
        options: [
          { display: "Commuter la lumière", value: "toggleLight" },
          { display: "Allumer la lumière", value: "turnLightOn" },
          { display: "Éteindre la lumière", value: "turnLightOff" },
          { display: "Commuter la torche", value: "toggleTorche" },
          { display: "Allumer la torche", value: "turnTorcheOn" },
          { display: "Éteindre la torche", value: "turnTorcheOff" }
        ]
      }
    ]
  },
  {
    display: "TP-Link Tapo",
    value: ModuleEnum.Tapo,
    inputs: [
      { name: "Adresse IP", type: InputFormType.Text },
      {
        name: "Commande",
        type: InputFormType.Select,
        options: [
          { display: "Commuter la lumière", value: "toggle" },
          { display: "Allumer la lumière", value: "turnOn" },
          { display: "Éteindre la lumière", value: "turnOff" },
          { display: "Changer la luminosité", value: "brightness" }
        ]
      }
    ]
  }
];
