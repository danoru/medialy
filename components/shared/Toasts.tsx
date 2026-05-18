"use client";

import {
  Alert,
  Button,
  Snackbar,
  type AlertColor,
  type ButtonProps,
  type SnackbarCloseReason,
} from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

export type ToastSeverity = Extract<AlertColor, "success" | "info" | "warning" | "error">;

type ToastMessage = {
  id?: string;
  message: string;
  severity?: ToastSeverity;
};

type ToastContextValue = {
  showToast: (toast: ToastMessage) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const FLASH_TOAST_COOKIE = "medialy_toast";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Required<ToastMessage> | null>(null);
  const shownFlashIds = useRef(new Set<string>());

  const showToast = useCallback((nextToast: ToastMessage) => {
    setToast({
      id: nextToast.id ?? crypto.randomUUID(),
      message: nextToast.message,
      severity: nextToast.severity ?? "success",
    });
  }, []);

  const consumeFlashToast = useCallback(() => {
    const flashToast = readFlashToast();
    if (!flashToast || shownFlashIds.current.has(flashToast.id)) return;

    shownFlashIds.current.add(flashToast.id);
    showToast(flashToast);
    clearFlashToast();
  }, [showToast]);

  useEffect(() => {
    consumeFlashToast();
    const intervalId = window.setInterval(consumeFlashToast, 600);
    return () => window.clearInterval(intervalId);
  }, [consumeFlashToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  function handleClose(
    _event?: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason,
  ) {
    if (reason === "clickaway") return;
    setToast(null);
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        autoHideDuration={3600}
        onClose={handleClose}
        open={Boolean(toast)}
      >
        {toast ? (
          <Alert
            onClose={handleClose}
            severity={toast.severity}
            variant="filled"
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}

export function ActionToastButton({
  children,
  disabled,
  pendingLabel,
  successMessage,
  ...props
}: ButtonProps & {
  pendingLabel?: React.ReactNode;
  successMessage: string;
}) {
  const { pending } = useFormStatus();
  const { showToast } = useToast();
  const submittedRef = useRef(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (!wasPendingRef.current || !submittedRef.current) return;
    wasPendingRef.current = false;
    submittedRef.current = false;
    showToast({ message: successMessage, severity: "success" });
  }, [pending, showToast, successMessage]);

  return (
    <Button
      {...props}
      disabled={disabled || pending}
      onClick={(event) => {
        submittedRef.current = true;
        props.onClick?.(event);
      }}
      type="submit"
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

function readFlashToast() {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${FLASH_TOAST_COOKIE}=`));
  if (!cookie) return null;

  try {
    const rawValue = cookie.slice(FLASH_TOAST_COOKIE.length + 1);
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as ToastMessage;
    if (!parsed.id || !parsed.message) return null;
    return parsed as Required<ToastMessage>;
  } catch {
    return null;
  }
}

function clearFlashToast() {
  document.cookie = `${FLASH_TOAST_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
