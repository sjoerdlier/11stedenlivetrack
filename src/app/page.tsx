import RouteMapLoader from "@/components/RouteMapLoader";
import { loadRoute } from "@/lib/gpx";

export default function Home() {
  const { points, start } = loadRoute();

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <RouteMapLoader points={points} start={start} />
    </div>
  );
}
