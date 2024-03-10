import InputFormType from "@/enums/InputFormType";
import ModuleEnum from "@/enums/ModuleEnum";

export type Modules = {
  display: string;
  value: ModuleEnum;
  inputs: ModuleInputs[];
};

export type ModuleInputOptions = {
  display: string;
  value: string;
};

export type ModuleInputs = { name: string } & (
  | { type: Exclude<InputFormType, InputFormType.Select> }
  | {
      type: InputFormType.Select;
      options: ModuleInputOptions[];
    }
);
