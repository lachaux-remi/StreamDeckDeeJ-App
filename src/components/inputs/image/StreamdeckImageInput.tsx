import StreamdeckImage from "@/components/streamdeck/image/StreamdeckImage";
import useUploadStreamdeckButtonImageDialog from "@/hooks/useUploadStreamdeckButtonImageDialog";

import "./StreamdeckImageInput.scss";

export type StreamdeckImageInputProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
};

const StreamdeckImageInput = (props: StreamdeckImageInputProps) => {
  const { label, value, onChange } = props;

  const { renderDialog, setOpen } = useUploadStreamdeckButtonImageDialog({
    value,
    onConfirm: onChange
  });

  return (
    <>
      <fieldset className="input-image__content" onClick={() => setOpen(true)}>
        <legend className="content__title">
          <span>{label}</span>
        </legend>

        <div className="content__image">
          <StreamdeckImage image={value} />
        </div>
      </fieldset>

      {renderDialog}
    </>
  );
};

export default StreamdeckImageInput;
