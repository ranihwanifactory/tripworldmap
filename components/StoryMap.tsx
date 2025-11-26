import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Trip, TravelStop, TransportMode } from '../types';
import { ArrowLeft, Calendar, MapPin, Compass, Navigation, Plane, Car, Train, Ship, Bike, Footprints, Bus, AlertCircle } from 'lucide-react';

// --- Assets & Icons ---

// Standard Map Marker (Tiny dot for history)
const HistoryDotIcon = L.divIcon({
    className: 'custom-history-dot',
    html: `<div class="w-3 h-3 bg-white rounded-full border-2 border-gray-500 opacity-60"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

// Modern UX 3D Gradient Icons for Transport
const getTransportIcon = (mode: TransportMode) => {
    const colorMap = {
        [TransportMode.FLIGHT]: 'from-sky-400 to-blue-600',
        [TransportMode.CAR]: 'from-orange-400 to-red-600',
        [TransportMode.TRAIN]: 'from-emerald-400 to-green-600',
        [TransportMode.BUS]: 'from-yellow-400 to-orange-500',
        [TransportMode.SHIP]: 'from-cyan-400 to-blue-500',
        [TransportMode.BICYCLE]: 'from-lime-400 to-green-500',
        [TransportMode.WALK]: 'from-pink-400 to-rose-600',
    };
    
    const bgClass = colorMap[mode] || 'from-indigo-400 to-purple-600';
    
    const iconSvgs = {
        [TransportMode.FLIGHT]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M13 2l9 10-9 10"/><path d="M2 12l5-5m0 10l-5-5"/></svg>`,
        [TransportMode.CAR]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
        [TransportMode.TRAIN]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/></svg>`,
        [TransportMode.SHIP]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.8 2.38 8"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>`,
        [TransportMode.BUS]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="18" cy="18" r="2"/></svg>`,
        [TransportMode.BICYCLE]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`,
        [TransportMode.WALK]: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 11 3.8 11 8c0 1.25-.38 2.5-1 3.75"/><path d="M5.5 14h11c1.57 0 2.5 1.93 1.63 3.32L17 19"/><path d="M13 13v-3"/><path d="M8 16v-2"/></svg>`
    };

    const selectedIconSvg = iconSvgs[mode] || iconSvgs[TransportMode.FLIGHT];

    return L.divIcon({
        html: `
        <div class="relative group">
            <div class="absolute inset-0 bg-white rounded-full blur-md opacity-40 animate-pulse"></div>
            <div class="relative w-14 h-14 bg-gradient-to-br ${bgClass} rounded-full flex items-center justify-center shadow-xl border-[3px] border-white transform transition-transform duration-300">
                 ${selectedIconSvg}
            </div>
            <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-black/50 blur-sm rounded-full"></div>
        </div>`,
        className: 'custom-vehicle-icon',
        iconSize: [56, 56],
        iconAnchor: [28, 50] // Anchor at bottom center
    });
};

interface StoryMapProps {
    trip: Trip;
    stops: TravelStop[];
    onBack: () => void;
}

const MapController = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        if (!center) return;
        map.flyTo(center, map.getZoom(), { duration: 2.0, easeLinearity: 0.2 });
    }, [center, map]);
    return null;
};

// Transport Icon Component for the UI
const UIIcon = ({ mode }: { mode: TransportMode }) => {
    switch(mode) {
        case TransportMode.FLIGHT: return <Plane className="w-4 h-4" />;
        case TransportMode.CAR: return <Car className="w-4 h-4" />;
        case TransportMode.TRAIN: return <Train className="w-4 h-4" />;
        case TransportMode.SHIP: return <Ship className="w-4 h-4" />;
        case TransportMode.BICYCLE: return <Bike className="w-4 h-4" />;
        case TransportMode.WALK: return <Footprints className="w-4 h-4" />;
        case TransportMode.BUS: return <Bus className="w-4 h-4" />;
        default: return <Plane className="w-4 h-4" />;
    }
}

const StoryMap: React.FC<StoryMapProps> = ({ trip, stops, onBack }) => {
    const [activeStopIndex, setActiveStopIndex] = useState(0);
    const [vehiclePos, setVehiclePos] = useState<[number, number] | null>(null);
    const [activeTransportMode, setActiveTransportMode] = useState<TransportMode>(TransportMode.FLIGHT);
    const [simulatedSpeed, setSimulatedSpeed] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    
    // Safety: ensure stops exist and handle potential data issues
    const sortedStops = useMemo(() => {
        if (!stops || stops.length === 0) return [];
        return [...stops].sort((a, b) => a.order - b.order);
    }, [stops]);

    useEffect(() => {
        if (sortedStops.length > 0) {
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
            const cards = container.querySelectorAll('.magazine-card');
            
            if (cards.length === 0) return;

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
                        
                        // Interpolate Position
                        const startLat = sortedStops[i].coordinates.lat;
                        const startLng = sortedStops[i].coordinates.lng;
                        const endLat = sortedStops[i+1].coordinates.lat;
                        const endLng = sortedStops[i+1].coordinates.lng;
                        
                        const curLat = startLat + (endLat - startLat) * progress;
                        const curLng = startLng + (endLng - startLng) * progress;
                        
                        setVehiclePos([curLat, curLng]);
                        setSimulatedSpeed(Math.round(progress * 120 + 20)); 
                        setActiveTransportMode(sortedStops[i+1].transportMode);
                        break;
                    }
                }
            }
            
            if (!foundActive) {
                 const lastIdx = cards.length - 1;
                 const lastCardRect = cards[lastIdx].getBoundingClientRect();
                 // If the last card is near center or above
                 if (lastCardRect.top <= containerHeight / 2) {
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
            // Trigger once initially
            handleScroll();
        }
        return () => container?.removeEventListener('scroll', handleScroll);
    }, [sortedStops]);

    // --- RENDER GUARD ---
    if (sortedStops.length === 0) {
        return (
            <div className="w-full h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
                <AlertCircle className="w-16 h-16 text-gray-600 mb-4" />
                <h2 className="text-2xl font-serif">여행 경로가 없습니다.</h2>
                <p className="text-gray-400 mt-2 mb-8">아직 등록된 여행지가 없습니다.</p>
                <button 
                    onClick={onBack}
                    className="px-6 py-2 bg-white text-black rounded-full font-bold hover:bg-gray-200"
                >
                    돌아가기
                </button>
            </div>
        );
    }

    // Safe access
    const currentStop = sortedStops[activeStopIndex] || sortedStops[0];
    const initialCenter: [number, number] = [currentStop.coordinates.lat, currentStop.coordinates.lng];

    return (
        <div className="relative w-full h-screen overflow-hidden flex flex-col md:flex-row bg-slate-900 font-sans text-white">
            {/* Map Background - Full Screen */}
            <div className="absolute inset-0 z-0 h-full w-full">
                <MapContainer 
                    center={initialCenter} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    scrollWheelZoom={true}
                    doubleClickZoom={true}
                    dragging={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <ZoomControl position="bottomright" />
                    
                    {/* Trajectory */}
                    <Polyline 
                        positions={sortedStops.map(s => [s.coordinates.lat, s.coordinates.lng])}
                        pathOptions={{ color: '#fff', weight: 2, opacity: 0.3, dashArray: '5, 10' }}
                    />

                    {/* History Dots */}
                    {sortedStops.map((stop, idx) => (
                        <Marker 
                            key={stop.id} 
                            position={[stop.coordinates.lat, stop.coordinates.lng]}
                            icon={HistoryDotIcon}
                            opacity={idx <= activeStopIndex ? 0.8 : 0.3}
                        />
                    ))}

                    {/* Active Vehicle */}
                    {vehiclePos && (
                        <Marker 
                            position={vehiclePos} 
                            icon={getTransportIcon(activeTransportMode)}
                            zIndexOffset={1000}
                        />
                    )}

                    <MapController center={vehiclePos || initialCenter} />
                </MapContainer>
            </div>

            {/* --- Modern HUD Overlay (Top Right) --- */}
            <div className="absolute top-6 right-6 z-30 flex flex-col items-end pointer-events-none">
                <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 text-white shadow-2xl flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">Live Tracking</span>
                    </div>
                    <div className="h-4 w-px bg-white/20"></div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-bold font-mono text-emerald-400">{simulatedSpeed}</span>
                        <span className="text-[10px] text-gray-500 font-mono">km/h</span>
                    </div>
                    <div className="h-4 w-px bg-white/20"></div>
                     <div className="flex items-center text-gray-300">
                        <Compass className="w-4 h-4 mr-2" />
                        <span className="font-mono text-xs">{activeStopIndex + 1}/{sortedStops.length}</span>
                    </div>
                </div>
            </div>

            {/* --- Navigation Bar (Top Left) --- */}
            <div className="absolute top-6 left-6 z-30 flex items-center space-x-4 pointer-events-none">
                <button onClick={onBack} className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full p-3 text-white transition-all hover:scale-105 shadow-lg">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-white font-serif text-2xl drop-shadow-lg tracking-wide hidden md:block bg-black/20 px-4 py-1 rounded-lg backdrop-blur-sm">
                    {trip.title}
                </h1>
            </div>

            {/* --- Magazine Content Stream (Left Side Overlay) --- */}
            <div 
                ref={containerRef}
                className="absolute top-0 left-0 h-full w-full md:w-[480px] z-20 overflow-y-auto no-scrollbar scroll-smooth snap-y snap-mandatory bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-auto"
            >
                {/* Intro Card */}
                <div className="h-[50vh] w-full flex flex-col justify-end p-8 md:p-12 snap-start">
                    <div className="animate-fade-in-up">
                        <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur text-xs font-bold tracking-widest text-white uppercase mb-4 rounded-sm">
                            Travel Journal
                        </span>
                        <h1 className="text-5xl md:text-6xl font-serif text-white leading-tight mb-4 drop-shadow-xl">
                            {trip.title}
                        </h1>
                        <p className="text-gray-300 text-lg font-light leading-relaxed max-w-sm border-l-2 border-white/30 pl-4 bg-black/20 p-2 rounded-r">
                            {trip.description}
                        </p>
                        <div className="mt-8 flex items-center text-sm text-gray-400">
                             <span className="animate-bounce mr-2">↓</span> Scroll to explore
                        </div>
                    </div>
                </div>

                {/* Magazine Story Cards */}
                {sortedStops.map((stop, index) => (
                    <div 
                        key={stop.id} 
                        className="magazine-card snap-center w-full min-h-screen flex items-center p-4 md:p-8"
                    >
                        <div className={`
                            w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden shadow-2xl
                            transition-all duration-700 ease-out transform
                            ${index === activeStopIndex ? 'opacity-100 translate-x-0 scale-100' : 'opacity-30 -translate-x-8 scale-95'}
                        `}>
                            {/* Image Header */}
                            {stop.imageUrl && (
                                <div className="h-64 w-full relative overflow-hidden">
                                    <img src={stop.imageUrl} alt={stop.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded text-white text-xs font-bold flex items-center uppercase tracking-widest border border-white/10">
                                        <div className="mr-2 text-emerald-400">
                                            <UIIcon mode={stop.transportMode} />
                                        </div>
                                        {stop.transportMode} Arrival
                                    </div>
                                    {/* Stop Number Badge */}
                                    <div className="absolute -bottom-6 right-8 text-8xl font-serif text-white/10 font-black pointer-events-none select-none z-0">
                                        {index + 1}
                                    </div>
                                </div>
                            )}

                            {/* Content Body */}
                            <div className="p-8 relative z-10">
                                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">
                                    <MapPin className="w-3 h-3" />
                                    <span>{stop.locationName}</span>
                                </div>
                                
                                <h2 className="text-3xl font-serif text-white mb-6 leading-tight">
                                    {stop.title}
                                </h2>
                                
                                <div className="prose prose-invert prose-p:text-gray-300 prose-p:font-light prose-p:leading-loose">
                                    <p>
                                        <span className="text-4xl float-left mr-2 mt-[-10px] font-serif text-emerald-500">{stop.description.charAt(0)}</span>
                                        {stop.description.slice(1)}
                                    </p>
                                </div>
                                
                                <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center text-xs text-gray-500 font-mono">
                                    <div className="flex items-center">
                                        <Calendar className="w-3 h-3 mr-2" />
                                        {(stop.arrivalDate as any).toDate ? (stop.arrivalDate as any).toDate().toLocaleDateString() : new Date(stop.arrivalDate as any).toLocaleDateString()}
                                    </div>
                                    <div className="text-right max-w-[50%] truncate">
                                        {stop.address}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {/* Outro */}
                <div className="h-[50vh] w-full flex items-center justify-center p-12 snap-end">
                    <div className="text-center">
                        <div className="inline-block p-4 rounded-full bg-white/10 backdrop-blur-md mb-4 border border-white/10">
                            <Footprints className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-serif text-white mb-2">Journey Completed</h2>
                        <p className="text-gray-400">Thank you for watching.</p>
                        <button onClick={onBack} className="mt-8 text-emerald-400 hover:text-emerald-300 text-sm font-bold uppercase tracking-widest hover:underline">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryMap;