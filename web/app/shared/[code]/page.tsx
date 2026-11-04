import { SubscriptionViewer } from "@/components/subscriptions/SubscriptionViewer";
export const dynamic = "force-dynamic";
export default async function SharedMembership({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SubscriptionViewer accessCode={code} />;
}
