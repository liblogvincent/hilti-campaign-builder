import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useLuban } from "@/store/luban";

export const Route = createFileRoute("/content/")({
  component: ContentIndex,
});

function ContentIndex() {
  const activeId = useLuban((s) => s.activeCampaignId);
  return <Navigate to="/content/$campaignId" params={{ campaignId: activeId }} />;
}
