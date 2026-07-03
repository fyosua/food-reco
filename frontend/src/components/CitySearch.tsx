import { useState, useEffect, useRef } from "react";
import { api, type City } from "../lib/api";

interface CitySearchProps {
  value: number | null;
  onChange: (city: City) => void;
  placeholder?: string;
}

export default function CitySearch({
  value,
  onChange,
  placeholder = "Cari kota...",
}: CitySearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search on query change
  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cities = await api.searchCities(query);
        setResults(cities);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (city: City) => {
    setSelectedCity(city);
    setQuery(city.name);
    setIsOpen(false);
    onChange(city);
  };

  const handleClear = () => {
    setSelectedCity(null);
    setQuery("");
    onChange(null as unknown as City);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedCity) setSelectedCity(null);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {selectedCity && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
            ...
          </span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((city) => (
            <button
              key={city.id}
              onClick={() => handleSelect(city)}
              className={`w-full text-left px-3 py-2.5 hover:bg-primary-50 transition text-sm ${
                value === city.id ? "bg-primary-50 text-primary-700" : ""
              }`}
            >
              <span className="font-medium">{city.name}</span>
              {city.province_name && (
                <span className="text-gray-400 ml-1">— {city.province_name}</span>
              )}
              {city.is_jabodetabek && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                  Jabodetabek
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedCity && (
        <p className="text-xs text-gray-500 mt-1">
          {selectedCity.name}, {selectedCity.province_name}
          {selectedCity.is_jabodetabek ? " (Jabodetabek pricing)" : ""}
        </p>
      )}
    </div>
  );
}