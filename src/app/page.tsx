"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CreateRoomModal } from "@/components/create-room-modal";
import { JoinRoomModal } from "@/components/join-room-modal";
import { useToast } from "@/components/ui/toast";
import { createRoom, validateRoomCode } from "@/lib/rooms";
import { getVoterId } from "@/lib/voter-session";

export default function Home() {
  const router = useRouter();
  const { showToast } = useToast();
  const [voterId, setVoterId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    console.log("[Qup Home] client hydrated");
    setVoterId(getVoterId());
  }, []);

  async function handleCreateRoom(roomName: string) {
    if (isCreating) return;

    const sessionId = voterId || getVoterId();
    if (!sessionId) {
      showToast("Could not start a session. Refresh and try again.", "error");
      return;
    }

    setIsCreating(true);

    try {
      const { code } = await createRoom(roomName, sessionId);
      showToast(`Room ${code} is live`, "success");
      setIsCreateOpen(false);
      router.push(`/room/${code}`);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not create room. Try again.",
        "error",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinRoom(roomCode: string) {
    if (isJoining) return;

    setIsJoining(true);

    try {
      const { code } = await validateRoomCode(roomCode);
      setIsJoinOpen(false);
      router.push(`/room/${code}`);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not join room. Try again.",
        "error",
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-5 text-white">
        <h1 className="text-6xl font-bold">Qup</h1>
        <p className="mt-4 text-center text-gray-400">
          Crowd-powered music for cafés and bars.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              console.log("CREATE_CLICKED");
              console.log("OPEN_CREATE_MODAL");
              setIsCreateOpen(true);
            }}
            className="min-h-12 touch-manipulation rounded-full bg-white px-8 py-3.5 font-semibold text-black transition-all duration-200 hover:bg-gray-200 active:scale-[0.98]"
          >
            Create Room
          </button>

          <button
            type="button"
            onClick={() => {
              console.log("JOIN_CLICKED");
              console.log("OPEN_JOIN_MODAL");
              setIsJoinOpen(true);
            }}
            className="min-h-12 touch-manipulation rounded-full border border-white/15 bg-white/[0.04] px-8 py-3.5 font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] active:scale-[0.98]"
          >
            Join a Room
          </button>
        </div>
      </main>

      <CreateRoomModal
        isOpen={isCreateOpen}
        isCreating={isCreating}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateRoom}
      />

      <JoinRoomModal
        isOpen={isJoinOpen}
        isJoining={isJoining}
        onClose={() => setIsJoinOpen(false)}
        onJoin={handleJoinRoom}
      />
    </>
  );
}
