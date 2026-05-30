import { getAdminVoteRecords } from "@/app/actions/admin-employees";
import { VotesDashboard } from "@/components/VotesDashboard";

export const dynamic = "force-dynamic";

export default async function AdminVotesPage() {
  const votes = await getAdminVoteRecords();
  return <VotesDashboard votes={votes} />;
}
