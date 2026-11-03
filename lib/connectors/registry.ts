// Connectors by source slug (detection_sources.slug). Adding a source means
// writing a connector, registering it here, and inserting its registry row.
import { iphdAdapter } from "@/lib/connectors/iphd"
import type { SourceAdapter } from "@/lib/connectors/types"

export const ADAPTERS: Record<string, SourceAdapter> = {
  [iphdAdapter.slug]: iphdAdapter,
}
