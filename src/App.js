import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [city, setCity] = useState("");
  const [units, setUnits] = useState(() => localStorage.getItem("units") || "metric");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bgClass, setBgClass] = useState("bg-default");
  const [themeClass, setThemeClass] = useState("theme-default");
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => {
    try {
      const h = JSON.parse(localStorage.getItem("history") || "[]");
      return Array.isArray(h) ? h : [];
    } catch {
      return [];
    }
  });

  const API_KEY = "f48225c38aa161d7b84ff592aaefad0d";
  const unitSymbol = units === "metric" ? "°C" : "°F";
  const speedUnit = units === "metric" ? "m/s" : "mph";
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("units", units);
  }, [units]);

  const updateBackground = (w) => {
    if (!w) {
      setBgClass("bg-default");
      setThemeClass("theme-default");
      return;
    }
    const id = w.weather?.[0]?.id || 800;
    let bg = "bg-default";
    let theme = "theme-default";

    if (id >= 200 && id < 300) { bg = "bg-thunder"; theme = "theme-thunder"; }
    else if (id >= 300 && id < 600) { bg = "bg-rain"; theme = "theme-rain"; }
    else if (id >= 600 && id < 700) { bg = "bg-snow"; theme = "theme-snow"; }
    else if (id >= 700 && id < 800) { bg = "bg-fog"; theme = "theme-fog"; }
    else if (id === 800) { bg = "bg-clear"; theme = "theme-clear"; }
    else if (id > 800) { bg = "bg-clouds"; theme = "theme-clouds"; }

    setBgClass(bg);
    setThemeClass(theme);
  };

  const saveHistory = (name) => {
    if (!name) return;
    const newList = [name, ...history.filter((c) => c.toLowerCase() !== name.toLowerCase())].slice(0, 6);
    setHistory(newList);
    localStorage.setItem("history", JSON.stringify(newList));
  };

  const formatTime = (unix, tzOffsetSec) => {
    if (!unix) return "-";
    const d = new Date((unix + tzOffsetSec) * 1000);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  };

  const handleError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 3000);
  };

  const getByCity = async (name, chosenUnits = units) => {
    if (!name?.trim()) return handleError("Please enter a city name.");
    setLoading(true);
    try {
      const w = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(name)}&appid=${API_KEY}&units=${chosenUnits}`
      );
      const f = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(name)}&appid=${API_KEY}&units=${chosenUnits}`
      );
      setWeather(w.data);
      setForecast(extractDailyNoonForecasts(f.data.list));
      updateBackground(w.data);
      saveHistory(w.data.name);
    } catch {
      handleError("City not found or API error.");
    } finally {
      setLoading(false);
    }
  };

  const getByCoords = async (lat, lon, chosenUnits = units) => {
    setLoading(true);
    try {
      const w = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${chosenUnits}`
      );
      const f = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${chosenUnits}`
      );
      setWeather(w.data);
      setForecast(extractDailyNoonForecasts(f.data.list));
      updateBackground(w.data);
      if (w.data?.name) saveHistory(w.data.name);
    } catch {
      handleError("Location fetch failed or API error.");
    } finally {
      setLoading(false);
    }
  };

  const extractDailyNoonForecasts = (list = []) => {
    const byDate = {};
    list.forEach((item) => {
      const dt = new Date(item.dt * 1000);
      const key = dt.toISOString().slice(0, 10);
      const hour = dt.getHours();
      const diffNoon = Math.abs(12 - hour);
      if (!byDate[key] || diffNoon < byDate[key].score) {
        byDate[key] = { ...item, score: diffNoon };
      }
    });
    const todayKey = new Date().toISOString().slice(0, 10);
    return Object.keys(byDate)
      .sort()
      .filter((d) => d >= todayKey)
      .slice(0, 5)
      .map((d) => byDate[d]);
  };

  const handleSearch = () => getByCity(city);
  const handleEnter = (e) => { if (e.key === "Enter") handleSearch(); };

  const toggleUnits = async () => {
    const newUnits = units === "metric" ? "imperial" : "metric";
    setUnits(newUnits);
    if (weather?.coord) {
      await getByCoords(weather.coord.lat, weather.coord.lon, newUnits);
    } else if (city.trim()) {
      await getByCity(city.trim(), newUnits);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return handleError("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        getByCoords(latitude, longitude);
      },
      () => handleError("Permission denied or location unavailable.")
    );
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const iconUrl = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`;
  const readableDay = (unix) => new Date(unix * 1000).toLocaleDateString(undefined, { weekday: "short" });
  const feelsLike = weather?.main?.feels_like;
  const tzOffset = weather?.timezone ?? 0;

  return (
    <div className={`app ${bgClass} ${themeClass}`}>
      <div className="overlay" />
      <div className="container">
        <h1 className="title">Weather App </h1>

        <div className="controls">
          <div className="searchbar">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search city…"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={handleEnter}
            />
            <button className="btn primary" onClick={handleSearch}>Search</button>
            <button className="btn" onClick={useMyLocation} title="Use my location">📍</button>
          </div>

          <div className="unit-toggle">
            <span className={`unit ${units === "metric" ? "active" : ""}`}>C</span>
            <label className="switch">
              <input type="checkbox" checked={units === "imperial"} onChange={toggleUnits} />
              <span className="slider" />
            </label>
            <span className={`unit ${units === "imperial" ? "active" : ""}`}>F</span>
          </div>
        </div>

        {history.length > 0 && (
          <div className="history">
            {history.map((h) => (
              <button key={h} className="chip" onClick={() => getByCity(h)}>{h}</button>
            ))}
            <button className="chip clear" onClick={() => { setHistory([]); localStorage.removeItem("history"); }}>
              Clear
            </button>
          </div>
        )}

        {error && <div className="toast">{error}</div>}

        {loading && (
          <div className="loader-wrap">
            <div className="spinner" />
            <div className="loader-text">Fetching weather…</div>
          </div>
        )}

        {!loading && weather && (
          <>
            <div className="card current">
              <div className="current-header">
                <div className="place">
                  <h2>{weather.name}</h2>
                  <p className="desc">{weather.weather?.[0]?.description?.replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                </div>
                <div className="temp">
                  <img className="icon" src={iconUrl(weather.weather?.[0]?.icon)} alt={weather.weather?.[0]?.main} />
                  <div className="temp-num">{Math.round(weather.main?.temp)}<span className="unit-sm">{unitSymbol}</span></div>
                </div>
              </div>

              <div className="current-grid">
                <div><span className="label">Feels like :</span><span className="value">{Math.round(feelsLike)}{unitSymbol}</span></div>
                <div><span className="label">Humidity :</span><span className="value">{weather.main?.humidity}%</span></div>
                <div><span className="label">Wind :</span><span className="value">{Math.round(weather.wind?.speed)} {speedUnit}</span></div>
                <div><span className="label">Sunrise :</span><span className="value">{formatTime(weather.sys?.sunrise, tzOffset)}</span></div>
                <div><span className="label">Sunset :</span><span className="value">{formatTime(weather.sys?.sunset, tzOffset)}</span></div>
                <div><span className="label">Pressure :</span><span className="value">{weather.main?.pressure} hPa</span></div>
              </div>
            </div>

            {forecast?.length > 0 && (
              <div className="card forecast">
                <div className="subheader">5-Day Forecast</div>
                <div className="forecast-scroll">
                  {forecast.map((f) => (
                    <div key={f.dt} className="forecast-item">
                      <div className="day">{readableDay(f.dt)}</div>
                      <img className="icon small" src={iconUrl(f.weather?.[0]?.icon)} alt={f.weather?.[0]?.main} />
                      <div className="temps">
                        <span className="t t-max">{Math.round(f.main?.temp_max)}{unitSymbol}</span>
                        <span className="t t-min">{Math.round(f.main?.temp_min)}{unitSymbol}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !weather && (
          <div className="hint">
            Try “Mumbai”, “Hyderabad”, or tap 📍 for your location.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
