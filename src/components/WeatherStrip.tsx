import type { WeatherSnapshot } from "@/lib/weather";
import { iconForWeatherCode } from "@/lib/weather";
import { formatTemperatureC, formatWindKmh } from "@/lib/format";
import styles from "./WeatherStrip.module.css";

interface WeatherStripProps {
  weather: WeatherSnapshot | null;
}

// One line of live weather context near the topbar's live status — not a
// forecast panel, just enough for someone tracking Lowie & Björn to know
// what conditions they're actually walking in right now. `weather` is null
// whenever loadWeather() couldn't reach Open-Meteo (see src/lib/weather.ts)
// or hasn't loaded yet — renders nothing rather than a placeholder, the
// same "absence is a normal state" treatment the donation button and
// Garmin link already get elsewhere in this file.
export default function WeatherStrip({ weather }: WeatherStripProps) {
  if (!weather) return null;

  return (
    <p className={styles.strip}>
      <span aria-hidden>{iconForWeatherCode(weather.weatherCode, weather.isDay)}</span>{" "}
      {formatTemperatureC(weather.temperatureC)} · {formatWindKmh(weather.windKmh)} · {weather.description}
    </p>
  );
}
