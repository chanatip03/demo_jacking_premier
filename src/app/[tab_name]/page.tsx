import LandingPage from "./landing_page";

interface PageProps {
  params: Promise<{
    tab_name: string;
  }>;
}

export default async function Page({ params }: Readonly<PageProps>) {
  const { tab_name } = await params;

  return <LandingPage tabName={tab_name} />;
}
