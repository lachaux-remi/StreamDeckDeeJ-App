import { useEffect, useState } from "react";

import SelectInput from "@/components/inputs/SelectInput";
import TextInput from "@/components/inputs/TextInput";
import TextareaInput from "@/components/inputs/TextareaInput";
import { modules } from "@/components/streamdeck/Modules";
import KeyUsageEnum from "@/enums/KeyUsageEnum";
import ModuleEnum from "@/enums/ModuleEnum";
import useSettings from "@/hooks/useSettings";
import { StreamdeckInputKey, StreamdeckKey } from "@/types/SettingsType";
import { objectToInputOptions } from "@/utils/ObjectUtil";

type ModuleInputProps = {
  type: KeyUsageEnum;
  inputIndex: StreamdeckInputKey;
  onChange: (config: Partial<StreamdeckKey>) => void;
};

const ModuleInput = (props: ModuleInputProps) => {
  const { type, inputIndex, onChange } = props;

  const config = useSettings().getStreamdeckInputConfig(inputIndex);
  const [module, setModule] = useState<ModuleEnum | undefined>(config?.[type]?.module);
  const [params, setParams] = useState<string[]>(config?.[type]?.params || []);

  useEffect(() => onChange({ module, params }), [module, params]);

  const handleChangeModule = (value: ModuleEnum) => {
    setModule(value);
    setParams([]);
  };

  const handleChangeParams = (index: number, value: string) => {
    const paramsCopy = [...params];
    paramsCopy[index] = value;
    setParams(paramsCopy);
  };

  const otherInputs = () => {
    return modules
      .find(m => m.value === module)
      ?.inputs.map((input, index) => {
        switch (input.type) {
          case "select":
            return (
              <SelectInput
                key={`${type}-${module}-${index}`}
                label={input.name}
                options={objectToInputOptions(input.options)}
                value={params[index]}
                onChange={value => handleChangeParams(index, value)}
              />
            );
          case "textarea":
            return (
              <TextareaInput
                key={`${type}-${module}-${index}`}
                label={input.name}
                value={params[index]}
                onChange={value => handleChangeParams(index, value)}
              />
            );
          case "text":
          default:
            return (
              <TextInput
                key={`${type}-${module}-${index}`}
                label={input.name}
                value={params[index]}
                onChange={value => handleChangeParams(index, value)}
              />
            );
        }
      });
  };

  return (
    <>
      <SelectInput
        label="Module"
        options={objectToInputOptions(modules, { "": "Sectionner un module" })}
        value={module}
        onChange={value => handleChangeModule(value as ModuleEnum)}
      />
      {otherInputs()}
    </>
  );
};

export default ModuleInput;
