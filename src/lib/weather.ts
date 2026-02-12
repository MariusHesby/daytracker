// Weather service using Open-Meteo API (free, no API key required)

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

export interface WeatherCondition {
  description: string;
  icon: string;
  gradient: string;
}

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs
export function getWeatherCondition(code: number, isDay: boolean): WeatherCondition {
  const conditions: Record<number, WeatherCondition> = {
    0: { description: "Clear sky", icon: isDay ? "☀️" : "🌙", gradient: isDay ? "from-yellow-400/20 to-orange-300/10" : "from-indigo-500/20 to-purple-400/10" },
    1: { description: "Mainly clear", icon: isDay ? "🌤️" : "🌙", gradient: isDay ? "from-yellow-300/15 to-blue-200/10" : "from-indigo-400/15 to-gray-500/10" },
    2: { description: "Partly cloudy", icon: "⛅", gradient: "from-gray-300/20 to-blue-200/10" },
    3: { description: "Overcast", icon: "☁️", gradient: "from-gray-400/25 to-gray-300/15" },
    45: { description: "Foggy", icon: "🌫️", gradient: "from-gray-400/30 to-gray-300/20" },
    48: { description: "Depositing rime fog", icon: "🌫️", gradient: "from-gray-400/30 to-blue-200/15" },
    51: { description: "Light drizzle", icon: "🌧️", gradient: "from-blue-400/25 to-gray-300/15" },
    53: { description: "Moderate drizzle", icon: "🌧️", gradient: "from-blue-500/30 to-gray-400/20" },
    55: { description: "Dense drizzle", icon: "🌧️", gradient: "from-blue-600/35 to-gray-500/25" },
    56: { description: "Freezing drizzle", icon: "🌨️", gradient: "from-blue-300/30 to-cyan-200/20" },
    57: { description: "Heavy freezing drizzle", icon: "🌨️", gradient: "from-blue-400/35 to-cyan-300/25" },
    61: { description: "Slight rain", icon: "🌧️", gradient: "from-blue-400/25 to-gray-300/15" },
    63: { description: "Moderate rain", icon: "🌧️", gradient: "from-blue-500/35 to-gray-400/20" },
    65: { description: "Heavy rain", icon: "🌧️", gradient: "from-blue-600/40 to-gray-500/25" },
    66: { description: "Freezing rain", icon: "🌨️", gradient: "from-blue-300/35 to-cyan-200/25" },
    67: { description: "Heavy freezing rain", icon: "🌨️", gradient: "from-blue-400/40 to-cyan-300/30" },
    71: { description: "Slight snow", icon: "🌨️", gradient: "from-white/30 to-blue-100/20" },
    73: { description: "Moderate snow", icon: "❄️", gradient: "from-white/40 to-blue-200/25" },
    75: { description: "Heavy snow", icon: "❄️", gradient: "from-white/50 to-blue-300/30" },
    77: { description: "Snow grains", icon: "🌨️", gradient: "from-white/35 to-gray-200/20" },
    80: { description: "Slight rain showers", icon: "🌦️", gradient: "from-blue-300/25 to-yellow-200/10" },
    81: { description: "Moderate rain showers", icon: "🌦️", gradient: "from-blue-400/35 to-gray-300/20" },
    82: { description: "Violent rain showers", icon: "⛈️", gradient: "from-blue-600/45 to-gray-500/30" },
    85: { description: "Slight snow showers", icon: "🌨️", gradient: "from-white/35 to-blue-200/20" },
    86: { description: "Heavy snow showers", icon: "🌨️", gradient: "from-white/45 to-blue-300/30" },
    95: { description: "Thunderstorm", icon: "⛈️", gradient: "from-purple-500/40 to-gray-600/30" },
    96: { description: "Thunderstorm with hail", icon: "⛈️", gradient: "from-purple-600/45 to-gray-700/35" },
    99: { description: "Thunderstorm with heavy hail", icon: "⛈️", gradient: "from-purple-700/50 to-gray-800/40" },
  };

  return conditions[code] || { description: "Unknown", icon: "🌡️", gradient: "from-gray-300/20 to-gray-200/10" };
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`
    );
    
    if (!response.ok) {
      throw new Error('Weather API request failed');
    }

    const data = await response.json();
    
    return {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
    };
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

// Location storage helpers
const LOCATION_KEY = 'daytracker_location';

export interface StoredLocation {
  latitude: number;
  longitude: number;
  name: string;
}

export function getStoredLocation(): StoredLocation | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCATION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setStoredLocation(location: StoredLocation): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
}

export function clearStoredLocation(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCATION_KEY);
}

// Geocoding using Open-Meteo's geocoding API
export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State/region
}

export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding API request failed');
    }

    const data = await response.json();
    
    if (!data.results) return [];
    
    return data.results.map((result: { name: string; latitude: number; longitude: number; country: string; admin1?: string }) => ({
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country,
      admin1: result.admin1,
    }));
  } catch (error) {
    console.error('Failed to search location:', error);
    return [];
  }
}
