import { createFileRoute } from "@tanstack/react-router";

import { App } from "@/components/anon/App";

export const Route = createFileRoute("/")({
  component: App,
});
