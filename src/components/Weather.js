'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function Weather() {
  const [city, setCity] = useState('');
  const [weatherData, setWeatherData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const supabase = createClient();

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get coordinates using Geocoding API
      const geoResponse = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`
      );
      const geoData = await geoResponse.json();

      console.log('geoData: ', geoData);

      if (!geoData.length) {
        throw new Error('City not found');
      }

      const { lat, lon, country } = geoData[0];

      // Then get weather data
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily&units=metric&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`
      );
      const data = await weatherResponse.json();

      console.log('data: ', data)

      // Save to Supabase
      const { error: dbError } = await supabase.from('weather_records').insert({
        city,
        country,
        temperature: data.current.temp,
        humidity: data.current.humidity,
        weather_description: data.current.weather[0].description,
        timestamp: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      // Fetch historical data
      const { data: histData, error: histError } = await supabase
        .from('weather_records')
        .select('*')
        .eq('city', city)
        .order('timestamp', { ascending: false })
        .limit(5);

      if (histError) throw histError;

      setWeatherData(data.current);
      setHistoricalData(histData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate average temperature from historical data
  const avgTemperature = historicalData.length
    ? historicalData.reduce((sum, record) => sum + record.temperature, 0) / historicalData.length
    : null;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-4">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter city name"
          className="w-full p-2 border rounded"
        />
        <button
          onClick={fetchWeather}
          disabled={loading || !city}
          className="w-full mt-2 p-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {loading ? 'Loading...' : 'Get Weather'}
        </button>
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}

      {weatherData && (
        <div className="p-4 mb-4 bg-white rounded shadow">
          <h2 className="text-xl font-bold mb-2">Current Weather in {city}</h2>
          <p>Temperature: {weatherData.temp}°C</p>
          <p>Feels like: {weatherData.feels_like}°C</p>
          <p>Humidity: {weatherData.humidity}%</p>
          <p>Weather: {weatherData.weather[0].description}</p>
        </div>
      )}

      {historicalData.length > 0 && (
        <div className="p-4 bg-white rounded shadow">
          <h2 className="text-xl font-bold mb-2">Historical Data</h2>
          <p className="mb-2">Average Temperature: {avgTemperature?.toFixed(1)}°C</p>
          <div className="space-y-2">
            {historicalData.map((record) => (
              <div key={record.id} className="p-2 bg-gray-50 rounded">
                <p>Temperature: {record.temperature}°C</p>
                <p>Humidity: {record.humidity}%</p>
                <p className="text-sm text-gray-500">
                  {new Date(record.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
