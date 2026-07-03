import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "@/components/chat/Chat";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <Chat />;
}
