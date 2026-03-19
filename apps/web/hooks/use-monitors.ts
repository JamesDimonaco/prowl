"use client";

import { useState, useCallback } from "react";
import { mockMonitors, mockResults, type MockMonitor, type MockScrapeResult } from "@/lib/mock-data";

// This hook will be replaced with Convex queries when connected
// For now it uses mock data with local state

export function useMonitors() {
  const [monitors, setMonitors] = useState<MockMonitor[]>(mockMonitors);

  const createMonitor = useCallback((data: {
    name: string;
    url: string;
    prompt: string;
    checkInterval: MockMonitor["checkInterval"];
  }) => {
    const now = Date.now();
    const newMonitor: MockMonitor = {
      _id: `mon_${Date.now()}`,
      ...data,
      status: "active",
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setMonitors((prev) => [newMonitor, ...prev]);
    return newMonitor;
  }, []);

  const updateMonitor = useCallback((id: string, data: Partial<MockMonitor>) => {
    setMonitors((prev) =>
      prev.map((m) =>
        m._id === id ? { ...m, ...data, updatedAt: Date.now() } : m
      )
    );
  }, []);

  const deleteMonitor = useCallback((id: string) => {
    setMonitors((prev) => prev.filter((m) => m._id !== id));
  }, []);

  const togglePause = useCallback((id: string) => {
    setMonitors((prev) =>
      prev.map((m) =>
        m._id === id
          ? { ...m, status: m.status === "paused" ? "active" : "paused", updatedAt: Date.now() }
          : m
      )
    );
  }, []);

  return { monitors, createMonitor, updateMonitor, deleteMonitor, togglePause };
}

export function useMonitorResults(monitorId: string) {
  return mockResults.filter((r) => r.monitorId === monitorId);
}
