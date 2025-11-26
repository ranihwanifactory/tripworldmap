import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Trip, TravelStop, TransportMode } from '../types';
import { ArrowLeft, Share2, Calendar, MapPin, Navigation, Compass, Gauge } from 'lucide-react';

// Fix Leaflet default icon using CDN
const ICON_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const ICON_SHADOW_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: ICON_URL,
    shadowUrl: ICON_SHADOW_URL,
    iconAnchor: [12, 41],
    iconSize: [25, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Modern Pulse Icon for Vehicle
const VehicleIcon = ({ mode, rotation }: { mode: TransportMode; rotation: number }) => {
    return L.divIcon({
        html: `
        <div class="relative flex items-center justify-center w-12 h-12">
            <div class="absolute inset-0 bg-indigo-500 rounded-full opacity-30 animate-ping"></div>
            <div class="relative bg-indigo-600 rounded-full p-2 border-2 border-white shadow-xl transform transition-transform duration-300" style="transform: rotate(${rotation}deg);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${getIconSvg(mode)}</svg>
            </div>
        </div>`,
        className: 'custom-vehicle-icon',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });
};

const getIconSvg = (mode: TransportMode) => {
    switch (mode) {
        case TransportMode.FLIGHT: return '<path d="M2 12h20"/><path d="M13 2l9 10-9 10"/><path d="M2 12l5-5m0 10l-5-5"/>'; 
        case TransportMode.WALK: return '<path d="M13 4v7l-3 2v6"/><path d="M9 4v7l3 2v6"/><circle cx="11" cy="2" r="2"/>'; // Simplified walk
        case TransportMode.TRAIN: return '<rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/>';
        case TransportMode.SHIP: return '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.8 2.38 8"/><path d="M12 10v4"/><path d="M12 2v3"/>';
        case TransportMode.CAR: return '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>';
        default: return '<circle cx="12" cy="12" r="3"/>'; 
    }
}

interface StoryMapProps {
    trip: Trip;
    stops: TravelStop[];
    onBack: () => void;
}

const MapController = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        // Smooth flyTo, allowing user interaction to override temporarily if needed
        map.flyTo(center, map.getZoom(), { duration: 1.5, easeLinearity: 0.25 });
    }, [center, map]);
    return null;
};

const StoryMap: React.FC<StoryMapProps> = ({ trip, stops, onBack }) => {
    const [activeStopIndex, setActiveStopIndex] = useState(0);
    const [vehiclePos, setVehiclePos] = useState<[number, number] | null>(null);
    const [vehicleRotation, setVehicleRotation] = useState(0);
    const [activeTransportMode, setActiveTransportMode] = useState<TransportMode>(TransportMode.FLIGHT);
    
    // Simulating speed for UX
    const [simulatedSpeed, setSimulatedSpeed] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const sortedStops = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);

    useEffect(() => {
        if (sortedStops.length > 0 && !vehiclePos) {
            setVehiclePos([sortedStops[0].coordinates.lat, sortedStops[0].coordinates.lng]);
            setActiveTransportMode(sortedStops[0].transportMode);
        }
    }, [sortedStops]);

    // Scroll Logic
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || sortedStops.length === 0) return;
            
            const container = containerRef.current;
            const containerHeight = window.innerHeight;
            const cards = container.querySelectorAll('.story-card');
            
            let foundActive = false;

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const rect = card.getBoundingClientRect();
                const viewCenter = containerHeight / 2;

                if (i < cards.length - 1) {
                    const nextCard = cards[i+1];
                    const nextRect = nextCard.getBoundingClientRect();
                    const currentCenter = rect.top + rect.height / 2;
                    const nextCenter = nextRect.top + nextRect.height / 2;
                    
                    if (viewCenter >= currentCenter && viewCenter < nextCenter) {
                        foundActive = true;
                        setActiveStopIndex(i);
                        
                        const totalDistance = nextCenter - currentCenter;
                        const progress = (viewCenter - currentCenter) / totalDistance;
                        
                        const startLat = sortedStops[i].coordinates.lat;
                        const startLng = sortedStops[i].coordinates.lng;
                        const endLat = sortedStops[i+1].coordinates.lat;
                        const endLng = sortedStops[i+1].coordinates.lng;
                        
                        const curLat = startLat + (endLat - startLat) * progress;
                        const curLng = startLng + (endLng - startLng) * progress;
                        
                        setVehiclePos([curLat, curLng]);
                        
                        const dy = endLat - startLat;
                        const dx = endLng - startLng;
                        const angle = Math.atan2(dx, dy) * (180 / Math.PI);
                        setVehicleRotation(angle);
                        
                        // Fake speed based on progress change (aesthetic only)
                        setSimulatedSpeed(Math.round(progress * 100));

                        setActiveTransportMode(sortedStops[i+1].transportMode);
                        break;
                    }
                }
            }
            
            if (!foundActive && cards.length > 0) {
                 const lastIdx = cards.length - 1;
                 const lastCardRect = cards[lastIdx].getBoundingClientRect();
                 if (lastCardRect.top + lastCardRect.height / 2 <= containerHeight / 2) {
                     setActiveStopIndex(lastIdx);
                     setVehiclePos([sortedStops[lastIdx].coordinates.lat, sortedStops[lastIdx].coordinates.lng]);
                     setSimulatedSpeed(0);
                 } else if (cards[0].getBoundingClientRect().top > containerHeight / 2) {
                     setActiveStopIndex(0);
                     setVehiclePos([sortedStops[0].coordinates.lat, sortedStops[0].coordinates.lng]);
                     setSimulatedSpeed(0);
                 }
            }
        };

        const container = containerRef.current;
        if(container) {
            container.addEventListener('scroll', handleScroll);
            handleScroll();
        }
        return () => container?.removeEventListener('scroll', handleScroll);
    }, [sortedStops]);

    if (sortedStops.length === 0) return <div>No stops recorded.</div>;

    const currentStop = sortedStops[activeStopIndex];

    return (
        <div className="relative w-full h-screen overflow-hidden flex flex-col md:flex-row bg-gray-900 font-sans">
            {/* Map Background */}
            <div className="absolute inset-0 z-0">
                <MapContainer 
                    center={[currentStop.coordinates.lat, currentStop.coordinates.lng]} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false} // We add it manually to position it better
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <ZoomControl position="bottomright" />
                    
                    <Polyline 
                        positions={sortedStops.map(s => [s.coordinates.lat, s.coordinates.lng])}
                        pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.4, dashArray: '5, 10' }}
                    />

                    {sortedStops.map((stop, idx) => (
                        <Marker 
                            key={stop.id} 
                            position={[stop.coordinates.lat, stop.coordinates.lng]}
                            opacity={idx === activeStopIndex ? 1 : 0.5}
                        />
                    ))}

                    {vehiclePos && (
                        <Marker 
                            position={vehiclePos} 
                            icon={VehicleIcon({ mode: activeTransportMode, rotation: vehicleRotation })}
                            zIndexOffset={1000}
                        />
                    )}

                    <MapController center={vehiclePos || [currentStop.coordinates.lat, currentStop.coordinates.lng]} />
                </MapContainer>
            </div>

            {/* HUD / Cockpit Overlay */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 z-30 flex flex-col items-end pointer-events-none">
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-white shadow-2xl flex items-center space-x-6">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Mode</span>
                        <div className="bg-indigo-600/20 p-2 rounded-lg text-indigo-400">
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{getIconSvg(activeTransportMode)}</svg>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Speed</span>
                        <div className="flex items-baseline">
                            <span className="text-2xl font-bold font-mono">{simulatedSpeed}</span>
                            <span className="text-xs text-gray-500 ml-1">km/h</span>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Heading</span>
                        <div className="flex items-center text-emerald-400 font-mono">
                            <Compass className="w-3 h-3 mr-1" />
                            {Math.round(vehicleRotation)}°
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation & Title */}
            <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center space-x-3">
                <button onClick={onBack} className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-3 text-white hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-5 py-2 text-white pointer-events-auto">
                    <span className="font-bold text-sm tracking-wide">{trip.title}</span>
                </div>
            </div>

            {/* Scrollytelling Container */}
            <div 
                ref={containerRef}
                className="absolute inset-0 z-10 overflow-y-auto snap-y snap-mandatory md:w-[450px] md:left-0 md:relative no-scrollbar scroll-smooth"
                style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)' }}
            >
                <div className="h-[40vh] w-full flex items-end justify-center pb-10">
                    <div className="text-white text-center drop-shadow-lg p-6 animate-fade-in-up">
                        <div className="bg-indigo-600 w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mb-4 mx-auto rounded-full"></div>
                        <h1 className="text-5xl font-black mb-4 tracking-tight leading-tight">{trip.title}</h1>
                        <p className="text-lg opacity-80 font-light">Scroll to start journey</p>
                    </div>
                </div>

                {sortedStops.map((stop, index) => (
                    <div 
                        key={stop.id} 
                        className="story-card snap-center w-full min-h-[85vh] flex items-center justify-center p-6"
                    >
                        <div className={`
                            w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl
                            transition-all duration-700 transform
                            ${index === activeStopIndex ? 'scale-100 opacity-100 translate-x-0' : 'scale-90 opacity-40 -translate-x-10'}
                        `}>
                            {stop.imageUrl && (
                                <div className="h-64 w-full overflow-hidden relative group">
                                    <img src={stop.imageUrl} alt={stop.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                    <div className="absolute bottom-4 left-4 text-white">
                                        <div className="flex items-center text-xs font-bold bg-indigo-600 px-2 py-1 rounded mb-2 w-max uppercase">
                                            <Navigation className="w-3 h-3 mr-1" />
                                            {stop.transportMode} ARRIVAL
                                        </div>
                                        <h2 className="text-2xl font-bold">{stop.title}</h2>
                                    </div>
                                </div>
                            )}
                            <div className="p-6 text-white">
                                <div className="flex items-center space-x-2 text-indigo-300 mb-3 text-xs tracking-wider uppercase font-bold">
                                    <MapPin className="w-3 h-3" />
                                    <span>{stop.locationName}</span>
                                </div>
                                
                                <p className="text-gray-200 leading-relaxed text-sm mb-6 font-light border-l-2 border-indigo-500 pl-4">
                                    {stop.description}
                                </p>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-gray-400">
                                    <div className="flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {(stop.arrivalDate as any).toDate ? (stop.arrivalDate as any).toDate().toLocaleDateString() : new Date(stop.arrivalDate as any).toLocaleDateString()}
                                    </div>
                                    <div className="truncate max-w-[150px]">
                                        {stop.address}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="h-[40vh] flex items-center justify-center">
                     <div className="bg-indigo-600 px-8 py-4 rounded-full font-bold text-white shadow-lg animate-bounce">
                        End of Journey 🏁
                     </div>
                </div>
            </div>
        </div>
    );
};

export default StoryMap;