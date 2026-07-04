"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog, type DialogTone } from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type AlertOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
};

type PromptOptions = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: string;
};

type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type Mode = "confirm" | "alert" | "prompt";

type DialogState = {
  mode: Mode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  inputLabel?: string;
  placeholder?: string;
  inputType?: string;
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const resolverRef = useRef<((value: boolean | string | null) => void) | null>(null);

  const close = useCallback((value: boolean | string | null) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value) => resolve(Boolean(value));
      setState({
        mode: "confirm",
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
      });
      setInputValue("");
      setOpen(true);
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setState({
        mode: "alert",
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel || "OK",
        tone: "default",
      });
      setInputValue("");
      setOpen(true);
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (value) => resolve(typeof value === "string" ? value : null);
      setState({
        mode: "prompt",
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel || "Continue",
        cancelLabel: options.cancelLabel || "Cancel",
        inputLabel: options.label,
        placeholder: options.placeholder,
        inputType: options.inputType || "text",
        tone: "default",
      });
      setInputValue(options.defaultValue || "");
      setOpen(true);
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert, prompt }), [confirm, alert, prompt]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {state && (
        <Dialog
          open={open}
          title={state.title}
          description={state.description}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          tone={state.tone}
          showCancel={state.mode !== "alert"}
          input={
            state.mode === "prompt"
              ? {
                  label: state.inputLabel,
                  placeholder: state.placeholder,
                  type: state.inputType,
                }
              : undefined
          }
          inputValue={inputValue}
          onInputChange={setInputValue}
          onConfirm={() => {
            if (state.mode === "prompt") close(inputValue);
            else if (state.mode === "alert") close(true);
            else close(true);
          }}
          onCancel={() => {
            if (state.mode === "prompt") close(null);
            else if (state.mode === "alert") close(true);
            else close(false);
          }}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
