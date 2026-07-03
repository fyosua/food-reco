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
  const [allCities, setAllCities] = useState<City[]>([]);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load all cities on mount, show after typing 1+ chars
  useEffect(() => {
    if (!loaded) {
      setIsLoading(true);
      // Load all cities with a single empty query (max 1000)
      api.searchCities("", 1000).then((cities) => {
        setAllCities(cities);
        setLoaded(true);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [loaded]);

  // Filter locally based on query
  useEffect(() => {
    if (query.length < 1) {
      setFilteredCities([]);
      return;
    }
    const q = query.toLowerCase();
    const results = allCities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.province_name && c.province_name.toLowerCase().includes(q))
    );
    // Sort: exact matches first, then startsWith, then includes
    results.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName === q) return -1;
      if (bName === q) return 1;
      if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
      if (bName.startsWith(q) && !aName.startsWith(q)) return 1;
      return 0;
    });
    setFilteredCities(results);
    if (results.length > 0) setIsOpen(true);
  }, [query, allCities]);

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

  const handleFocus = () => {
    if (query.length >= 1 && filteredCities.length > 0) {
      setIsOpen(true);
    }
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
          onFocus={handleFocus}
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

      {isOpen && filteredCities.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredCities.map((city) => (
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