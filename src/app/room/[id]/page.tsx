import { RoomView } from "@/components/room/room-view";

export default async function RoomPage({
  params,
}: PageProps<"/room/[id]">) {
  const { id } = await params;

  return <RoomView roomId={id} />;
}
