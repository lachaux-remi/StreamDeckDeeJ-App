import { InputOptionType } from "@/types/InputType";

export const range = (start: number, stop: number): number[] => {
  return Array.from({ length: stop - start + 1 }, (_, i) => start + i);
};

export const objectToInputOptions = (
  objects: InputOptionType[],
  defaultField?: {
    [key: string]: string;
  }
): Record<string, string> => {
  return {
    ...defaultField,
    ...objects
      .map(object => [object.value, object.display])
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value
        }),
        {}
      )
  };
};
