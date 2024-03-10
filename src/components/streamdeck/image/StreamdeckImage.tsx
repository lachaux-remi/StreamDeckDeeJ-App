import { KeyboardCommandKeyRounded } from "@mui/icons-material";

import "./StreamdeckImage.scss";

type StreamdeckImageProps = {
  image?: string;
  [key: string]: string | number | boolean | undefined;
};

const StreamdeckImage = (props: StreamdeckImageProps) => {
  const { image, ...otherProps } = props;

  if (image) {
    // return create new element with svg data
    return (
      <div
        {...otherProps}
        className={`streamdeck__image ${otherProps.className || ""}`}
        dangerouslySetInnerHTML={{ __html: image }}
      ></div>
    );
  }

  return (
    <div {...otherProps} className={`streamdeck__no-image ${otherProps.className || ""}`}>
      <KeyboardCommandKeyRounded />
    </div>
  );
};

export default StreamdeckImage;
