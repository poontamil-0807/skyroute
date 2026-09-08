import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { FlightRoute, Airport, Waypoint } from "../types";

interface MapViewProps {
  origin: Airport;
  destination: Airport;
  routes: FlightRoute[];
  recommendedRouteName: string;
  selectedRouteId: string;
  onSelectRoute: (routeId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  origin,
  destination,
  routes,
  recommendedRouteName,
  selectedRouteId,
  onSelectRoute,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        attributionControl: false,
        zoomControl: true,
      }).setView([20, 0], 3);

      // CartoDB Dark Matter tiles - perfect for cockpit night display
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Add neat aviation scale
      L.control.scale({ imperial: true, metric: true, position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Update Layers when routes or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const allLatLngs: L.LatLngTuple[] = [];

    // Helper for airport icon
    const createAirportIcon = (code: string, isOrigin: boolean) => {
      const bg = isOrigin ? "#3B82F6" : "#10B981";
      return L.divIcon({
        className: "custom-airport-pin",
        html: `
          <div style="
            background: ${bg};
            color: white;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            padding: 3px 6px;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.4);
            box-shadow: 0 4px 10px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            <span>✈</span>
            <span>${code}</span>
          </div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });
    };

    // Helper for waypoint dot
    const createWaypointIcon = (color: string, index: number, isHazard: boolean) => {
      const ringColor = isHazard ? "#EF4444" : color;
      return L.divIcon({
        className: "custom-waypoint-dot",
        html: `
          <div style="
            width: 14px;
            height: 14px;
            background: #0B1220;
            border: 2.5px solid ${ringColor};
            border-radius: 50%;
            box-shadow: 0 0 8px ${ringColor}80;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transform: translate(-50%, -50%);
          ">
            <div style="width: 4px; height: 4px; background: ${ringColor}; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    };

    // 1. Draw Routes Polylines & Waypoint Markers
    routes.forEach((route) => {
      const isRecommended = route.name === recommendedRouteName;
      const isSelected = route.id === selectedRouteId;

      let lineColor = "#64748B"; // default inactive alternative
      let weight = 2.5;
      let opacity = 0.6;
      let dashArray = "4, 6";

      if (isRecommended) {
        lineColor = "#10B981"; // green
        weight = isSelected ? 5 : 4;
        opacity = 0.95;
        dashArray = "";
      } else if (isSelected) {
        lineColor = "#3B82F6"; // aviation blue
        weight = 4;
        opacity = 0.9;
        dashArray = "";
      }

      const pathCoords: L.LatLngTuple[] = route.waypoints.map((wp) => [wp.latitude, wp.longitude]);
      pathCoords.forEach((pt) => allLatLngs.push(pt));

      // Polyline
      const polyline = L.polyline(pathCoords, {
        color: lineColor,
        weight,
        opacity,
        dashArray,
      });

      polyline.on("click", () => {
        onSelectRoute(route.id);
      });

      layerGroup.addLayer(polyline);

      // Waypoints
      route.waypoints.forEach((wp: Waypoint) => {
        // Skip endpoints if already covered by airport pins
        if (wp.index === 0 || wp.index === 4) return;

        const isHazard = (wp.weather?.wind_speed_kmh || 0) >= 40 || (wp.weather?.humidity_pct || 0) >= 90;
        const wpMarker = L.marker([wp.latitude, wp.longitude], {
          icon: createWaypointIcon(lineColor, wp.index, isHazard),
        });

        const weatherHtml = wp.weather?.available
          ? `
            <div style="font-family: monospace; font-size: 11px; margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <div><strong>Temp:</strong> ${wp.weather.temperature_c}°C</div>
              <div><strong>Humidity:</strong> ${wp.weather.humidity_pct}%</div>
              <div><strong>Wind:</strong> ${wp.weather.wind_speed_kmh} km/h</div>
              <div><strong>Wind Dir:</strong> ${wp.weather.wind_direction_deg}°</div>
            </div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 4px; font-family: monospace;">
              Route Bearing: ${wp.bearing}°
            </div>
          `
          : `<div style="font-size: 11px; color: #EF4444; margin-top: 4px;">Weather telemetry unavailable</div>`;

        const popupContent = `
          <div style="min-width: 170px;">
            <div style="font-weight: bold; font-size: 12px; color: ${isRecommended ? "#10B981" : "#38BDF8"}; border-bottom: 1px solid #1E2E4A; padding-bottom: 3px;">
              ${route.name} — WP ${wp.index}
            </div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">
              Lat: ${wp.latitude.toFixed(3)}, Lon: ${wp.longitude.toFixed(3)}
            </div>
            ${weatherHtml}
          </div>
        `;

        wpMarker.bindPopup(popupContent);
        layerGroup.addLayer(wpMarker);
      });
    });

    // 2. Add Origin and Destination Markers
    const originMarker = L.marker([origin.latitude, origin.longitude], {
      icon: createAirportIcon(origin.ident, true),
    }).bindPopup(`
      <div style="min-width: 160px; font-family: sans-serif;">
        <div style="font-weight: bold; color: #60A5FA; font-size: 13px;">${origin.ident} (Departure)</div>
        <div style="font-size: 11px; color: #E2E8F0; margin-top: 2px;">${origin.name}</div>
        <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">${origin.municipality}, ${origin.country}</div>
      </div>
    `);
    layerGroup.addLayer(originMarker);

    const destMarker = L.marker([destination.latitude, destination.longitude], {
      icon: createAirportIcon(destination.ident, false),
    }).bindPopup(`
      <div style="min-width: 160px; font-family: sans-serif;">
        <div style="font-weight: bold; color: #34D399; font-size: 13px;">${destination.ident} (Arrival)</div>
        <div style="font-size: 11px; color: #E2E8F0; margin-top: 2px;">${destination.name}</div>
        <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">${destination.municipality}, ${destination.country}</div>
      </div>
    `);
    layerGroup.addLayer(destMarker);

    // Fit map bounds smoothly
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
  }, [routes, recommendedRouteName, selectedRouteId, origin, destination, onSelectRoute]);

  return (
    <div className="relative w-full h-[380px] sm:h-[480px] lg:h-full min-h-[400px] rounded-2xl overflow-hidden border border-[#1E2E4A] bg-[#0B1220] shadow-xl">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Cockpit Map Overlay Badges */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 pointer-events-none">
        <div className="px-2.5 py-1 rounded-md bg-[#0B1220]/80 backdrop-blur border border-[#1E2E4A] text-[11px] font-mono text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>GREEN = RECOMMENDED</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-[#0B1220]/80 backdrop-blur border border-[#1E2E4A] text-[11px] font-mono text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span>GRAY/BLUE = ALTERNATIVES</span>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none">
        <div className="px-2 py-1 rounded bg-[#0B1220]/85 border border-[#1E2E4A] text-[10px] font-mono text-slate-400">
          Click any waypoint marker to inspect live weather
        </div>
      </div>
    </div>
  );
};
