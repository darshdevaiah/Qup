"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getStoredDisplayName,
  sanitizeDisplayName,
  setStoredDisplayName,
} from "@/lib/display-name";

export function useDisplayName() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    try {
      const stored = getStoredDisplayName();
      setDisplayName(stored);
      setShowJoinModal(!stored);
      console.log("[Qup Room] display name ready", {
        hasDisplayName: Boolean(stored),
        showJoinModal: !stored,
      });
    } catch (error) {
      console.error("[Qup Room] display name init failed", error);
      setDisplayName(null);
      setShowJoinModal(true);
    } finally {
      setIsReady(true);
    }
  }, []);

  const confirmName = useCallback((raw: string) => {
    const name = sanitizeDisplayName(raw);
    setStoredDisplayName(name);
    setDisplayName(name);
    setShowJoinModal(false);
  }, []);

  const openJoinModal = useCallback(() => {
    setShowJoinModal(true);
  }, []);

  return {
    displayName,
    isReady,
    showJoinModal,
    confirmName,
    openJoinModal,
  };
}
