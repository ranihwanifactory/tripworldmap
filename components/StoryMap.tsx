import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Trip, TravelStop, TransportMode, Comment } from '../types';
import { ArrowLeft, Calendar, MapPin, Compass, Navigation, Plane, Car, Train, Ship, Bike, Footprints, Bus, AlertCircle, Star, MessageSquare, Send, Trash2, Edit2, X } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';

// --- Assets & Icons ---

// Standard Map Marker (Tiny dot for history)
const HistoryDotIcon = L.divIcon({
    className: 'custom-history-dot',
    html: `<div class="w-3 h-3 bg-white rounded-full border-2 border-gray-500 opacity-60"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

// Modern UX 3D Gradient Icons for Transport - EMOJI BASED for high fidelity without assets
const getTransportIcon = (mode: TransportMode) => {
    const iconData = {
        [TransportMode.FLIGHT]: { emoji: '✈️', color: 'from-sky-400 to-blue-600' },
        [TransportMode.CAR]: { emoji: '🚗', color: 'from-orange-400 to-red-600' },
        [TransportMode.TRAIN]: { emoji: '🚄', color: 'from-emerald-400 to-green-600' },
        [TransportMode.BUS]: { emoji: '🚌', color: 'from-yellow-400 to-orange-500' },
        [TransportMode.SHIP]: { emoji: '🚢', color: 'from-cyan-400 to-blue-500' },
        [TransportMode.BICYCLE]: { emoji: '🚴', color: 'from-lime-400 to-green-500' },
        [TransportMode.WALK]: { emoji: '🚶', color: 'from-pink-400 to-rose-600' },
    };
    
    const { emoji, color } = iconData[mode] || iconData[TransportMode.FLIGHT];
    
    return L.divIcon({
        html: `
        <div class="relative group">
            <div class="absolute inset-0 bg-white rounded-full blur-md opacity-40 animate-pulse"></div>
            <div class="relative w-14 h-14 bg-gradient-to-br ${color} rounded-full flex items-center justify-center shadow-xl border-[3px] border-white transform transition-transform duration-300 hover:scale-110">
                 <span class="text-3xl filter drop-shadow-md grayscale-0">${emoji}</span>
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
    currentUser: User | null;
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

const StoryMap: React.FC<StoryMapProps> = ({ trip, stops, currentUser, onBack }) => {
    const [activeStopIndex, setActiveStopIndex] = useState(0);
    const [vehiclePos, setVehiclePos] = useState<[number, number] | null>(null);
    const [activeTransportMode, setActiveTransportMode] = useState<TransportMode>(TransportMode.FLIGHT);
    const [simulatedSpeed, setSimulatedSpeed] = useState(0);

    // Comments State
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [rating, setRating] = useState(5);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    
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

    // Fetch Comments
    useEffect(() => {
        const q = query(collection(db, `trips/${trip.id}/comments`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Comment));
            setComments(msgs);
        });
        return () => unsubscribe();
    }, [trip.id]);

    const handlePostComment = async () => {
        if (!currentUser) return alert('로그인이 필요합니다.');
        if (!newComment.trim()) return;

        try {
            if (editingCommentId) {
                await updateDoc(doc(db, `trips/${trip.id}/comments`, editingCommentId), {
                    text: newComment,
                    rating: rating,
                    updatedAt: Timestamp.now()
                });
                setEditingCommentId(null);
            } else {
                await addDoc(collection(db, `trips/${trip.id}/comments`), {
                    userId: currentUser.uid,
                    userName: currentUser.displayName || currentUser.email?.split('@')[0] || '익명',
                    text: newComment,
                    rating: rating,
                    createdAt: Timestamp.now()
                });
            }
            setNewComment('');
            setRating(5);
        } catch (e) {
            console.error(e);
            alert("댓글 저장 실패");
        }
    };

    const handleDeleteComment = async (id: string) => {
        if(!window.confirm("삭제하시겠습니까?")) return;
        await deleteDoc(doc(db, `trips/${trip.id}/comments`, id));
    };

    const handleStartEdit = (comment: Comment) => {
        setNewComment(comment.text);
        setRating(comment.rating);
        setEditingCommentId(comment.id);
        // Scroll to form (simple logic)
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

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
                <button onClick={onBack} className="mt-8 px-6 py-2 bg-white text-black rounded-full font-bold hover:bg-gray-200">
                    돌아가기
                </button>
            </div>
        );
    }

    const currentStop = sortedStops[activeStopIndex] || sortedStops[0];
    const initialCenter: [number, number] = [currentStop.coordinates.lat, currentStop.coordinates.lng];

    return (
        <div className="relative w-full h-screen overflow-hidden flex bg-slate-900 font-sans text-white">
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
                    
                    <Polyline 
                        positions={sortedStops.map(s => [s.coordinates.lat, s.coordinates.lng])}
                        pathOptions={{ color: '#fff', weight: 2, opacity: 0.3, dashArray: '5, 10' }}
                    />

                    {sortedStops.map((stop, idx) => (
                        <Marker 
                            key={stop.id} 
                            position={[stop.coordinates.lat, stop.coordinates.lng]}
                            icon={HistoryDotIcon}
                            opacity={idx <= activeStopIndex ? 0.8 : 0.3}
                        />
                    ))}

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

            {/* --- Navigation Bar (Top Left) --- */}
            <div className="absolute top-6 left-6 z-30 flex items-center space-x-4 pointer-events-none">
                <button onClick={onBack} className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full p-3 text-white transition-all hover:scale-105 shadow-lg">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-white font-serif text-2xl drop-shadow-lg tracking-wide hidden md:block bg-black/20 px-4 py-1 rounded-lg backdrop-blur-sm">
                    {trip.title}
                </h1>
            </div>

             {/* --- Modern HUD Overlay (Top Right) --- */}
             <div className="absolute top-6 right-6 z-30 flex flex-col items-end pointer-events-none">
                <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 text-white shadow-2xl flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">Live</span>
                    </div>
                    <div className="h-4 w-px bg-white/20"></div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-bold font-mono text-emerald-400">{simulatedSpeed}</span>
                        <span className="text-[10px] text-gray-500 font-mono">km/h</span>
                    </div>
                </div>
            </div>

            {/* --- Centered Magazine Stream --- */}
            <div 
                ref={containerRef}
                className="absolute inset-0 z-20 overflow-y-auto no-scrollbar scroll-smooth snap-y snap-mandatory bg-transparent pointer-events-auto"
            >
                {/* Space before first card to show full map */}
                <div className="h-[50vh] w-full snap-start flex items-center justify-center pointer-events-none">
                     <div className="text-center p-8 bg-black/30 backdrop-blur-sm rounded-xl border border-white/5 pointer-events-auto max-w-md mx-auto">
                        <span className="text-xs font-bold tracking-[0.3em] text-emerald-400 uppercase">Travel Log</span>
                        <h1 className="text-4xl md:text-5xl font-serif text-white mt-4 mb-2 shadow-black drop-shadow-lg">{trip.title}</h1>
                        <p className="text-gray-200 font-light">{trip.description}</p>
                        <div className="mt-8 animate-bounce text-emerald-400">Scroll Down</div>
                     </div>
                </div>

                {/* Cards */}
                {sortedStops.map((stop, index) => (
                    <div 
                        key={stop.id} 
                        className="magazine-card snap-center w-full min-h-screen flex items-center justify-center p-4 pointer-events-none"
                    >
                        {/* Compact Card */}
                        <div className={`
                            w-full max-w-md bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto
                            transition-all duration-700 ease-out transform
                            ${index === activeStopIndex ? 'opacity-100 translate-y-0 scale-100' : 'opacity-40 translate-y-12 scale-95'}
                        `}>
                            {stop.imageUrl && (
                                <div className="h-48 w-full relative overflow-hidden group">
                                    <img src={stop.imageUrl} alt={stop.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                                    <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center border border-white/10">
                                        <div className="mr-1"><UIIcon mode={stop.transportMode} /></div>
                                        {stop.transportMode}
                                    </div>
                                    <div className="absolute -bottom-4 -right-2 text-6xl font-serif text-white/10 font-black pointer-events-none">
                                        {index + 1}
                                    </div>
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex items-center space-x-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                    <MapPin className="w-3 h-3" />
                                    <span>{stop.locationName}</span>
                                </div>
                                <h2 className="text-2xl font-serif text-white mb-3">{stop.title}</h2>
                                <p className="text-gray-300 text-sm leading-relaxed font-light">{stop.description}</p>
                                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                                    <div className="flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {(stop.arrivalDate as any).toDate ? (stop.arrivalDate as any).toDate().toLocaleDateString() : new Date(stop.arrivalDate as any).toLocaleDateString()}
                                    </div>
                                    <div className="truncate max-w-[150px]">{stop.address}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {/* --- Review & Comments Section --- */}
                <div className="min-h-screen w-full flex items-center justify-center p-4 snap-start bg-black/80 backdrop-blur-md">
                    <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-serif text-white flex items-center">
                                <MessageSquare className="w-5 h-5 mr-2 text-emerald-400" />
                                여행자 리뷰 <span className="text-sm text-gray-500 ml-2 font-sans">({comments.length})</span>
                            </h2>
                        </div>

                        {/* Comment List */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6 custom-scrollbar">
                            {comments.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    첫 번째 리뷰를 남겨보세요!
                                </div>
                            ) : (
                                comments.map(comment => (
                                    <div key={comment.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold mr-3">
                                                    {comment.userName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{comment.userName}</div>
                                                    <div className="flex text-yellow-400 text-xs">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`w-3 h-3 ${i < comment.rating ? 'fill-current' : 'text-gray-600 fill-none'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {currentUser && currentUser.uid === comment.userId && (
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleStartEdit(comment)} className="text-gray-400 hover:text-emerald-400"><Edit2 className="w-3 h-3" /></button>
                                                    <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-gray-300 text-sm">{comment.text}</p>
                                        <div className="text-[10px] text-gray-600 mt-2">
                                            {comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                            {comment.updatedAt && ' (수정됨)'}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={commentsEndRef}></div>
                        </div>

                        {/* Comment Form */}
                        {currentUser ? (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                {editingCommentId && (
                                    <div className="flex justify-between text-xs text-emerald-400 mb-2">
                                        <span>댓글 수정 중...</span>
                                        <button onClick={() => { setEditingCommentId(null); setNewComment(''); }}><X className="w-3 h-3" /></button>
                                    </div>
                                )}
                                <div className="flex items-center mb-3">
                                    <span className="text-xs text-gray-400 mr-2">별점:</span>
                                    <div className="flex space-x-1 cursor-pointer">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star 
                                                key={star} 
                                                className={`w-5 h-5 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`}
                                                onClick={() => setRating(star)}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                        placeholder="여행에 대한 소감을 남겨주세요..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handlePostComment()}
                                    />
                                    <button 
                                        onClick={handlePostComment}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-2 transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-white/5 rounded-xl">
                                <p className="text-sm text-gray-400 mb-2">리뷰를 남기려면 로그인이 필요합니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryMap;