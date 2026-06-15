"use client";

import { Modal, type ModalProps } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

// App-wide modal: full-screen on phones (real scroll area, action buttons stay
// reachable above the on-screen keyboard), normal centered dialog on desktop.
export default function AppModal({ children, ...props }: ModalProps) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  return (
    <Modal
      centered
      radius={isMobile ? 0 : "lg"}
      transitionProps={{ transition: isMobile ? "slide-up" : "pop" }}
      {...props}
      fullScreen={isMobile}
    >
      {children}
    </Modal>
  );
}
