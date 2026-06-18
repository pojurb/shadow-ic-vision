import Workspace from "@/components/Workspace";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawFixture = params.qaFixture;
  const initialQaFixtureRequested = Array.isArray(rawFixture) ? rawFixture.length > 0 : Boolean(rawFixture);
  return <Workspace initialQaFixtureRequested={initialQaFixtureRequested} />;
}
