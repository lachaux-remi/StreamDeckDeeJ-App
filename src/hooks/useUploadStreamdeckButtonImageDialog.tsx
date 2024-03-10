import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper } from "@mui/material";
import { ChangeEvent, MouseEvent, useState } from "react";

import StreamdeckImage from "@/components/streamdeck/image/StreamdeckImage";

type UploadStreamdeckButtonImage = {
  value?: string;
  onConfirm: (playlistName: string) => void;
  onClose?: () => void;
};

const useUploadStreamdeckButtonImageDialog = (props: UploadStreamdeckButtonImage) => {
  const { value, onConfirm, onClose } = props;

  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | undefined>(value);

  const handleUploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        setImage(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleClose = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (onClose) {
      onClose();
    }

    setOpen(false);
    setImage(undefined);
  };

  const handledConfirm = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (image) {
      onConfirm(image);
    }

    setOpen(false);
    setImage(undefined);
  };

  const renderDialog = (
    <Dialog className="input-image__dialog" open={open} onClose={handleClose}>
      <DialogTitle>Modifier l'image</DialogTitle>

      <DialogContent>
        <Paper className="dialog__image" component="label" htmlFor="input-image">
          <StreamdeckImage image={image} />
        </Paper>

        <Button className="dialog__button" variant="contained" color="secondary" component="label">
          Choisir une image
          <input id="input-image" type="file" accept="image/svg+xml" hidden onChange={handleUploadImage} />
        </Button>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>
          Annuler
        </Button>
        <Button variant="contained" onClick={handledConfirm}>
          Valider
        </Button>
      </DialogActions>
    </Dialog>
  );

  return {
    open,
    setOpen,
    renderDialog
  };
};

export default useUploadStreamdeckButtonImageDialog;
