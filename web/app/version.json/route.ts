import { BUILT_AT } from "@/lib/data";

// Prerendered to /version.json at build time. Open pages poll it to notice a
// newer deploy (see components/LiveRefresh.tsx).
export const dynamic = "force-static";

export function GET() {
  return Response.json({ builtAt: BUILT_AT });
}
