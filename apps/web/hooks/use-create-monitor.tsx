"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useScraper } from "./use-scraper";
import { CreateMonitorSheet } from "@/components/prowl/create-monitor-sheet";
import { useMonitors } from "./use-monitors";
import { toast } from "sonner";
import type { ExtractionSchema } from "@prowl/shared";

type CheckInterval = "5m" | "15m" | "30m" | "1h" | "6h" | "24h";

interface CreateMonitorContextValue {
  open: () => void;
  isOpen: boolean;
  isScanning: boolean;
}

const CreateMonitorContext = createContext<CreateMonitorContextValue>({
  open: () => {},
  isOpen: false,
  isScanning: false,
});

export function useCreateMonitor() {
  return useContext(CreateMonitorContext);
}

export function CreateMonitorProvider({ children }: { children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const scraper = useScraper();
  const { createMonitor } = useMonitors();

  const open = useCallback(() => setSheetOpen(true), []);

  function handleCreated(data: {
    name: string;
    url: string;
    prompt: string;
    checkInterval: CheckInterval;
    schema: ExtractionSchema;
    initialMatchCount: number;
  }) {
    createMonitor(data);
    toast.success("Monitor created", {
      description: `Now watching ${new URL(data.url).hostname}`,
    });
  }

  return (
    <CreateMonitorContext.Provider
      value={{ open, isOpen: sheetOpen, isScanning: scraper.isLoading }}
    >
      {children}
      <CreateMonitorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreated={handleCreated}
        scraper={scraper}
      />
    </CreateMonitorContext.Provider>
  );
}
