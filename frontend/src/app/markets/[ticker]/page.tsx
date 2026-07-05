import TickerChartPage from "./TickerChartPage";

export default async function Page(props: PageProps<"/markets/[ticker]">) {
  const { ticker } = await props.params;
  return <TickerChartPage ticker={ticker.toUpperCase()} />;
}
