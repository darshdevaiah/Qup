"use client";

import { SoundProvider } from "@/contexts/sound-context";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SoundProvider>
      <ToastProvider>{children}</ToastProvider>
    </SoundProvider>
  );
}
