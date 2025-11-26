import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Trip, TravelStop, TransportMode } from '../types';
import { ArrowLeft, Share2, Calendar, MapPin, Car, Plane, Train, Ship, Footprints } from 'lucide-react';

// Fix Leaflet default icon issue using CDN URLs directly
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

const VehicleIcon = ({ mode, rotation }: { mode: TransportMode; rotation: number }) => {
    return L.divIcon({
        html: `<div style="transform: rotate(${rotation}deg); background: #4F46E5; padding: 8px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 2px solid white; display: flex; align-items: center; justify-content: center;">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${getIconSvg(mode)}</svg>
        </div>`,
        className: 'custom-vehicle-icon',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });
};

const getIconSvg = (mode: TransportMode) => {
    switch (mode) {
        case TransportMode.FLIGHT: return '<path d="M2 12h20"/><path d="M13 2l9 10-9 10"/><path d="M2 12l5-5m0 10l-5-5"/>'; 
        case TransportMode.WALK: return '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 11 3.8 11 8c0 2.85-1.67 5.12-2 9h9l-1 5h-9v-4z"/>';
        case TransportMode.TRAIN: return '<rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/>';
        case TransportMode.SHIP: return '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.8 2.38 8"/><path d="M12 10v4"/><path d="M12 2v3"/><path d="M7.3 6.86 12 11.44l4.7-4.58"/>';
        case TransportMode.CAR: return '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>';
        default: return '<circle cx="12" cy="12" r="3"/>'; 
    }
}

interface StoryMapProps {
    trip: Trip;
    stops: TravelStop[];
    onBack: () => void;
}

// Custom hook to animate map center
const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { duration: 1.0, easeLinearity: 0.5 });
    }, [center, zoom, map]);
    return null;
};

const StoryMap: React.FC<StoryMapProps> = ({ trip, stops, onBack }) => {
    const [activeStopIndex, setActiveStopIndex] = useState(0);
    const [vehiclePos, setVehiclePos] = useState<[number, number] | null>(null);
    const [vehicleRotation, setVehicleRotation] = useState(0);
    const [activeTransportMode, setActiveTransportMode] = useState<TransportMode>(TransportMode.FLIGHT);

    const containerRef = useRef<HTMLDivElement>(null);
    const sortedStops = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);

    // Initialize vehicle position
    useEffect(() => {
        if (sortedStops.length > 0 && !vehiclePos) {
            setVehiclePos([sortedStops[0].coordinates.lat, sortedStops[0].coordinates.lng]);
            setActiveTransportMode(sortedStops[0].transportMode);
        }
    }, [sortedStops]);

    // Calculate position based on scroll
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || sortedStops.length === 0) return;
            
            const container = containerRef.current;
            const containerHeight = window.innerHeight;
            const cards = container.querySelectorAll('.story-card');
            
            let foundActive = false;

            // Loop through cards to determine current position
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const rect = card.getBoundingClientRect();
                const viewCenter = containerHeight / 2;

                // Check if this card is roughly in view
                // We interpolate between current card i and next card i+1 based on scroll position
                
                if (i < cards.length - 1) {
                    const nextCard = cards[i+1];
                    const nextRect = nextCard.getBoundingClientRect();
                    
                    const currentCenter = rect.top + rect.height / 2;
                    const nextCenter = nextRect.top + nextRect.height / 2;
                    
                    // Logic: As we scroll down, content moves up.
                    // When 'currentCenter' is near 'viewCenter', we are at stop i.
                    // As 'currentCenter' moves up (decreases) and 'nextCenter' approaches 'viewCenter', we move to i+1.
                    
                    if (viewCenter >= currentCenter && viewCenter < nextCenter) {
                        foundActive = true;
                        setActiveStopIndex(i);
                        
                        // Calculate progress (0 to 1) between this stop and next
                        const totalDistance = nextCenter - currentCenter;
                        const progress = (viewCenter - currentCenter) / totalDistance;
                        
                        // Interpolate Coordinates
                        const startLat = sortedStops[i].coordinates.lat;
                        const startLng = sortedStops[i].coordinates.lng;
                        const endLat = sortedStops[i+1].coordinates.lat;
                        const endLng = sortedStops[i+1].coordinates.lng;
                        
                        const curLat = startLat + (endLat - startLat) * progress;
                        const curLng = startLng + (endLng - startLng) * progress;
                        
                        setVehiclePos([curLat, curLng]);
                        
                        // Calculate Rotation
                        const dy = endLat - startLat;
                        const dx = endLng - startLng;
                        const angle = Math.atan2(dx, dy) * (180 / Math.PI);
                        setVehicleRotation(angle);

                        // Use the transport mode of the next segment
                        setActiveTransportMode(sortedStops[i+1].transportMode);
                        break;
                    }
                }
            }
            
            // Handle limits
            if (!foundActive && cards.length > 0) {
                 const lastIdx = cards.length - 1;
                 const firstCardRect = cards[0].getBoundingClientRect();
                 const lastCardRect = cards[lastIdx].getBoundingClientRect();
                 
                 if (lastCardRect.top + lastCardRect.height / 2 <= containerHeight / 2) {
                     // Past the end
                     setActiveStopIndex(lastIdx);
                     setVehiclePos([sortedStops[lastIdx].coordinates.lat, sortedStops[lastIdx].coordinates.lng]);
                 } else if (firstCardRect.top > containerHeight / 2) {
                     // Before the start
                     setActiveStopIndex(0);
                     setVehiclePos([sortedStops[0].coordinates.lat, sortedStops[0].coordinates.lng]);
                 }
            }
        };

        const container = containerRef.current;
        if(container) {
            container.addEventListener('scroll', handleScroll);
            handleScroll(); // Initial calculation
        }
        return () => container?.removeEventListener('scroll', handleScroll);
    }, [sortedStops]);

    if (sortedStops.length === 0) return <div>No stops recorded.</div>;

    const currentStop = sortedStops[activeStopIndex];

    return (
        <div className="relative w-full h-screen overflow-hidden flex flex-col md:flex-row bg-gray-900">
            {/* Map Background (Fixed) */}
            <div className="absolute inset-0 z-0">
                <MapContainer 
                    center={[currentStop.coordinates.lat, currentStop.coordinates.lng]} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    scrollWheelZoom={false}
                    dragging={false}
                    doubleClickZoom={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                    />
                    
                    {/* Path Line */}
                    <Polyline 
                        positions={sortedStops.map(s => [s.coordinates.lat, s.coordinates.lng])}
                        pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.6, dashArray: '10, 10' }}
                    />

                    {/* All Markers (Past stops) */}
                    {sortedStops.map((stop, idx) => (
                        <Marker 
                            key={stop.id} 
                            position={[stop.coordinates.lat, stop.coordinates.lng]}
                            opacity={idx === activeStopIndex ? 1 : 0.6}
                        />
                    ))}

                    {/* The Active "Vehicle" */}
                    {vehiclePos && (
                        <Marker 
                            position={vehiclePos} 
                            icon={VehicleIcon({ mode: activeTransportMode, rotation: vehicleRotation })}
                            zIndexOffset={1000}
                        />
                    )}

                    {/* Smooth pan to current vehicle position or stop */}
                    <MapController center={vehiclePos || [currentStop.coordinates.lat, currentStop.coordinates.lng]} zoom={14} />
                </MapContainer>
            </div>

            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start pointer-events-none">
                <button onClick={onBack} className="pointer-events-auto bg-white/90 backdrop-blur rounded-full p-3 shadow-lg hover:bg-white transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-800" />
                </button>
                <div className="bg-white/90 backdrop-blur rounded-xl p-4 shadow-lg pointer-events-auto max-w-sm hidden md:block">
                    <h1 className="text-xl font-bold text-gray-900">{trip.title}</h1>
                    <p className="text-sm text-gray-500">{new Date(trip.startDate.seconds * 1000).toLocaleDateString()} 시작</p>
                </div>
                <button className="pointer-events-auto bg-white/90 backdrop-blur rounded-full p-3 shadow-lg hover:bg-white transition-colors">
                    <Share2 className="w-6 h-6 text-indigo-600" />
                </button>
            </div>

            {/* Scrollytelling Container */}
            <div 
                ref={containerRef}
                className="absolute inset-0 z-10 overflow-y-auto snap-y snap-mandatory md:w-1/3 md:left-0 md:relative md:bg-gradient-to-r md:from-black/40 scroll-smooth"
            >
                <div className="h-[40vh] w-full flex items-end justify-center pb-10">
                    <div className="text-white text-center drop-shadow-lg p-4">
                        <h1 className="text-4xl font-bold mb-2">{trip.title}</h1>
                        <p className="text-lg opacity-90">스크롤하여 여행 시작하기</p>
                        <div className="animate-bounce mt-4">↓</div>
                    </div>
                </div>

                {sortedStops.map((stop, index) => (
                    <div 
                        key={stop.id} 
                        className="story-card snap-center w-full min-h-[80vh] flex items-center justify-center p-6"
                    >
                        <div className={`
                            w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden
                            transition-all duration-500 transform
                            ${index === activeStopIndex ? 'scale-100 opacity-100 ring-4 ring-indigo-500/20' : 'scale-95 opacity-50'}
                        `}>
                            {stop.imageUrl && (
                                <div className="h-56 w-full overflow-hidden relative">
                                    <img src={stop.imageUrl} alt={stop.title} className="w-full h-full object-cover" />
                                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                                        {stop.transportMode}
                                    </div>
                                </div>
                            )}
                            <div className="p-6">
                                <div className="flex items-center space-x-2 text-indigo-600 mb-2">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-sm font-bold uppercase tracking-wide">{stop.locationName}</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-3">{stop.title}</h2>
                                <p className="text-gray-600 leading-relaxed text-sm mb-6">
                                    {stop.description}
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <div className="flex items-center text-gray-500 text-xs">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {(stop.arrivalDate as any).toDate ? (stop.arrivalDate as any).toDate().toLocaleDateString() : new Date(stop.arrivalDate as any).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate max-w-[150px]">
                                        {stop.address}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {/* Spacer at bottom */}
                <div className="h-[40vh] flex items-center justify-center">
                     <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full font-bold text-indigo-900 shadow-lg">
                        여행 종료 🎉
                     </div>
                </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 flex flex-col space-y-3">
                {sortedStops.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-3 h-3 rounded-full transition-all duration-500 border border-white/50 shadow-sm ${idx === activeStopIndex ? 'bg-indigo-500 scale-125' : 'bg-gray-400/50'}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default StoryMap;