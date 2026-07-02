import { Linkedin, Search, Facebook, Mail, Globe } from "lucide-react";
import type { AdChannel } from "@/types";

const MAP = {
  linkedin: Linkedin,
  google: Search,
  meta: Facebook,
  email: Mail,
  hol: Globe,
} as const;

const LABEL: Record<AdChannel, string> = {
  linkedin: "LinkedIn",
  google: "Google",
  meta: "Meta",
  email: "Email",
  hol: "Hilti.com",
};

export function ChannelIcon({ channel, className }: { channel: AdChannel; className?: string }) {
  const Icon = MAP[channel];
  return <Icon className={className ?? "w-3.5 h-3.5"} />;
}

export function channelLabel(channel: AdChannel): string {
  return LABEL[channel];
}
