"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for missing default icon in React-Leaflet
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
  lat: number;
  lng: number;
  radius: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

const LocationMarker = ({ lat, lng, onLocationSelect }: any) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return lat && lng ? <Marker position={[lat, lng]} /> : null;
};

// Component to programmatically change map view
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      try {
        map.setView(center, zoom);
      } catch (e) {
        console.warn("Leaflet map view error ignored during unmount");
      }
    }
  }, [center, map, zoom]);
  return null;
}

// Fix for Leaflet map not rendering correctly inside Modals
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map) {
        try {
          map.invalidateSize();
        } catch (e) {}
      }
    }, 300); // Wait for modal animation to finish
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function MapSelector({ lat, lng, radius, onLocationSelect }: MapSelectorProps) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const currentCenter: [number, number] = [lat || -6.200000, lng || 106.816666];
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        
        onLocationSelect(newLat, newLng);
      } else {
        alert("Lokasi tidak ditemukan. Coba kata kunci lain.");
      }
    } catch (error) {
      console.error("Error searching location:", error);
      alert("Terjadi kesalahan saat mencari lokasi.");
    } finally {
      setIsSearching(false);
    }
  };

  if (!mounted) {
    return (
      <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl flex flex-col items-center justify-center text-gray-500">
        <i className="fa-solid fa-map-location-dot text-3xl mb-2"></i>
        <span>Memuat Peta...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden border border-gray-200 relative z-0">
      
      {/* Search Bar */}
      <div className="bg-white p-2 border-b border-gray-200 z-10 shadow-sm">
        <form onSubmit={handleSearch} className="flex space-x-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari lokasi (cth: Monas, Jakarta)..." 
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold"
            />
            <i className="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
          </div>
          <button 
            type="submit" 
            disabled={isSearching}
            className="bg-pilar-darker hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center"
          >
            {isSearching ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : null}
            Cari
          </button>
        </form>
      </div>

      <div className="flex-1 w-full h-full relative z-0 min-h-[400px]">
        <MapContainer 
          center={currentCenter} 
          zoom={17} 
          scrollWheelZoom={true} 
          style={{ height: "100%", width: "100%" }}
        >
          <InvalidateSize />
          <ChangeView center={currentCenter} zoom={18} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker lat={lat} lng={lng} onLocationSelect={onLocationSelect} />
          {lat && lng && (
            <Circle 
              center={[lat, lng]} 
              radius={radius} 
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 1 }} 
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
