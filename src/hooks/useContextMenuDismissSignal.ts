import { RefObject, useEffect } from "react";

const useContextMenuDismissSignal = (
  modalRef: RefObject<HTMLDivElement | null>,
  dismissCallback: () => void,
  dismissOnClickOutside: boolean = true
) => {
  useEffect(() => {
    const element = modalRef.current;
    if (!element) {
      return;
    }

    const handleKeyboardEvent = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();

        dismissCallback();
      }
    };

    const handleMouseEvent = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (!element.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();

        dismissCallback();
      }
    };

    let ownerDocument: Document | null = null;

    let timoutID: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timoutID = null;

      ownerDocument = element.ownerDocument;
      ownerDocument.addEventListener("keydown", handleKeyboardEvent);
      if (dismissOnClickOutside) {
        ownerDocument.addEventListener("click", handleMouseEvent, true);
        ownerDocument.addEventListener("contextmenu", handleMouseEvent, true);
        ownerDocument.addEventListener("mousedown", handleMouseEvent, true);
        ownerDocument.addEventListener("scroll", dismissCallback, true);
      }
    }, 0);

    return () => {
      if (timoutID) {
        clearTimeout(timoutID);
      }

      if (ownerDocument) {
        ownerDocument.removeEventListener("keydown", handleKeyboardEvent);
        ownerDocument.removeEventListener("click", handleMouseEvent, true);
        ownerDocument.removeEventListener("contextmenu", handleMouseEvent, true);
        ownerDocument.removeEventListener("mousedown", handleMouseEvent, true);
        ownerDocument.removeEventListener("scroll", dismissCallback, true);
      }
    };
  }, [modalRef, dismissCallback, dismissOnClickOutside]);
};

export default useContextMenuDismissSignal;
