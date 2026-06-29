import { RelationshipListPage } from "@/components/crm/relationship-list-page";
import { AccountStage } from "@prisma/client";

type Props = { searchParams?: Promise<{ search?: string; industry?: string; stage?: AccountStage; state?: string; region?: string; sort?: string; direction?: "asc" | "desc" }> };

export default async function AllRelationshipsPage({ searchParams }: Props) {
  const params = await (searchParams ?? Promise.resolve({}));
  return <RelationshipListPage searchParams={params} />;
}
