import { PasscodeUnlockScreen } from "@/components/passcode-unlock-screen";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const { slug } = await params;
  const { return: returnTo } = await searchParams;
  return <PasscodeUnlockScreen scope={slug} returnTo={returnTo} />;
}
