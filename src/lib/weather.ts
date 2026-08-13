// Actual weather at the route, fetched from Open-Meteo (https://open-meteo.com)
// — free, no API key. Deliberately minimal: one current snapshot, not a
// forecast panel — see WeatherStrip for how little of this actually renders.

export interface WeatherSnapshot {
  temperatureC: number;
  windKmh: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
}

// WMO weather interpretation codes (the set Open-Meteo's `current_weather`
// returns) mapped to short Dutch phrases — deliberately terse, this feeds a
// one-line strip, not a forecast page. Grouped ranges (e.g. 61/63/65 =
// increasing rain intensity) collapse to the same or a closely related
// phrase rather than enumerating every code separately.
const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "helder",
  1: "licht bewolkt",
  2: "half bewolkt",
  3: "bewolkt",
  45: "mist",
  48: "mist",
  51: "lichte motregen",
  53: "motregen",
  55: "motregen",
  56: "aanvriezende motregen",
  57: "aanvriezende motregen",
  61: "lichte regen",
  63: "regen",
  65: "zware regen",
  66: "aanvriezende regen",
  67: "aanvriezende regen",
  71: "lichte sneeuw",
  73: "sneeuw",
  75: "zware sneeuw",
  77: "sneeuwkorrels",
  80: "regenbuien",
  81: "regenbuien",
  82: "hevige regenbuien",
  85: "sneeuwbuien",
  86: "sneeuwbuien",
  95: "onweer",
  96: "onweer met hagel",
  99: "onweer met hagel",
};

// Exported for the unit test and for WeatherStrip's aria-hidden icon — an
// unrecognized code (a future WMO addition Open-Meteo starts returning)
// falls back to a neutral phrase instead of showing nothing.
export function describeWeatherCode(code: number): string {
  return WEATHER_DESCRIPTIONS[code] ?? "wisselend weer";
}

// Icon set kept intentionally small (fair/cloudy/rain-or-snow/storm) rather
// than one glyph per WMO code — this is a small aria-hidden decoration next
// to the text description, not the primary signal.
export function iconForWeatherCode(code: number, isDay: boolean): string {
  if (code === 0 || code === 1) return isDay ? "☀️" : "🌙";
  if (code === 2 || code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code === 95 || code === 96 || code === 99) return "⛈️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "🌨️";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  return "🌤️";
}

interface OpenMeteoCurrentWeather {
  temperature: number;
  windspeed: number;
  weathercode: number;
  is_day: number;
}

interface OpenMeteoResponse {
  current_weather?: OpenMeteoCurrentWeather;
}

const OPEN_METEO_TIMEOUT_MS = 5_000;

// Never throws — a weather-API hiccup during a live event is exactly the
// kind of thing that shouldn't be able to take the page down (same
// contract as loadLivePositions/loadSetting's callers in page.tsx), so
// every failure path (bad response, timeout, network error, unexpected
// shape) resolves to null rather than rejecting.
export async function loadWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Europe%2FAmsterdam`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`loadWeather: Open-Meteo responded ${res.status}`);
      return null;
    }

    const data = (await res.json()) as OpenMeteoResponse;
    const current = data.current_weather;
    if (!current) {
      console.error("loadWeather: Open-Meteo response had no current_weather");
      return null;
    }

    return {
      temperatureC: current.temperature,
      windKmh: current.windspeed,
      weatherCode: current.weathercode,
      description: describeWeatherCode(current.weathercode),
      isDay: current.is_day === 1,
    };
  } catch (err) {
    console.error("loadWeather: fetch failed", err);
    return null;
  }
}
