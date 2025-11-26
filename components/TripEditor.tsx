import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, doc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Trip, TravelStop, TransportMode } from '../types';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Save, Wand2, X, Loader2, MapPin } from 'lucide-react';
import { enhanceStory } from '../services/geminiService';

// Fix Leaflet default icon (Missing assets in buildless env)
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

interface TripEditorProps {
    tripId?: string;
    userId: string;
    onClose: () => void;
    onSaveComplete: () => void;
}

// Helper component to pick location on click
const LocationPicker = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
    const [pos, setPos] = useState<[number, number] | null>(null);
    useMapEvents({
        click(e) {
            setPos([e.latlng.lat, e.latlng.lng]);
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return pos ? <Marker position={pos} /> : null;
};

const TripEditor: React.FC<TripEditorProps> = ({ tripId, userId, onClose, onSaveComplete }) => {
    // Trip State
    const [tripTitle, setTripTitle] = useState('');
    const [tripDesc, setTripDesc] = useState('');
    
    // Stop State
    const [stops, setStops] = useState<Partial<TravelStop>[]>([]);
    const [isAddingStop, setIsAddingStop] = useState(false);
    
    // Current Editing Stop
    const [currentStop, setCurrentStop] = useState<Partial<TravelStop>>({
        title: '',
        description: '',
        locationName: '',
        address: '',
        transportMode: TransportMode.FLIGHT,
        arrivalDate: new Date(),
        coordinates: { lat: 37.5665, lng: 126.9780 } // Default Seoul
    });
    const [stopImageFile, setStopImageFile] = useState<File | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleLocationSelect = (lat: number, lng: number) => {
        setCurrentStop(prev => ({ ...prev, coordinates: { lat, lng } }));
    };

    const handleAiEnhance = async () => {
        if (!currentStop.locationName || !currentStop.description) {
            alert('장소명과 간단한 메모를 먼저 입력해주세요.');
            return;
        }
        setIsAiLoading(true);
        const enhanced = await enhanceStory(
            currentStop.locationName, 
            currentStop.description, 
            currentStop.transportMode || '이동'
        );
        setCurrentStop(prev => ({ ...prev, description: enhanced }));
        setIsAiLoading(false);
    };

    const handleAddStop = async () => {
        if(!currentStop.title || !currentStop.locationName) {
            alert("제목과 장소명을 입력해주세요.");
            return;
        }

        let imageUrl = '';
        if (stopImageFile) {
            // In a real scenario, handle upload. For now, use object URL or mock
            // Try Firebase upload
            try {
                const storageRef = ref(storage, `stops/${userId}/${Date.now()}_${stopImageFile.name}`);
                await uploadBytes(storageRef, stopImageFile);
                imageUrl = await getDownloadURL(storageRef);
            } catch (e) {
                console.error("Storage failed (likely permission), using local preview", e);
                imageUrl = URL.createObjectURL(stopImageFile);
            }
        } else {
             imageUrl = `https://picsum.photos/800/600?random=${Math.random()}`;
        }

        const newStop: Partial<TravelStop> = {
            ...currentStop,
            id: Math.random().toString(36).substr(2, 9),
            imageUrl,
            order: stops.length + 1
        };

        setStops([...stops, newStop]);
        setIsAddingStop(false);
        // Reset
        setCurrentStop({
            title: '', description: '', locationName: '', address: '',
            transportMode: TransportMode.FLIGHT, arrivalDate: new Date(),
            coordinates: { lat: 37.5665, lng: 126.9780 }
        });
        setStopImageFile(null);
    };

    const handleSaveTrip = async () => {
        if (!tripTitle) return alert("여행 제목을 입력하세요");
        setIsSaving(true);
        
        try {
            // 1. Create Trip
            const tripData = {
                userId,
                title: tripTitle,
                description: tripDesc,
                startDate: Timestamp.fromDate(new Date()), // Simplify for demo
                isPublished: true,
                createdAt: Timestamp.now()
            };

            const docRef = await addDoc(collection(db, "trips"), tripData);
            
            // 2. Add Stops
            for (const stop of stops) {
                await addDoc(collection(db, `trips/${docRef.id}/stops`), {
                    ...stop,
                    tripId: docRef.id,
                    arrivalDate: Timestamp.fromDate(stop.arrivalDate as Date)
                });
            }

            onSaveComplete();
        } catch (error) {
            console.error("Error saving trip", error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
            <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-xl">
                {/* Header */}
                <div className="sticky top-0 bg-white z-20 border-b px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold">새로운 여행 기록하기</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Trip Info */}
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            placeholder="여행 제목 (예: 2024 유럽 배낭여행)" 
                            className="w-full text-3xl font-bold border-b-2 border-gray-200 focus:border-indigo-600 outline-none pb-2 placeholder-gray-300"
                            value={tripTitle}
                            onChange={(e) => setTripTitle(e.target.value)}
                        />
                        <textarea 
                            placeholder="이번 여행의 전체적인 테마나 소감을 적어주세요..." 
                            className="w-full text-gray-600 resize-none border p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                            rows={3}
                            value={tripDesc}
                            onChange={(e) => setTripDesc(e.target.value)}
                        />
                    </div>

                    {/* Stops List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <h3 className="text-lg font-semibold text-gray-800">여행 경로 ({stops.length})</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {stops.map((stop, idx) => (
                                <div key={idx} className="border rounded-xl p-4 flex items-start space-x-3 bg-gray-50">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{stop.title}</h4>
                                        <p className="text-xs text-gray-500">{stop.locationName}</p>
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{stop.description}</p>
                                    </div>
                                </div>
                            ))}
                            
                            <button 
                                onClick={() => setIsAddingStop(true)}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-gray-500 hover:border-indigo-500 hover:text-indigo-500 transition-colors min-h-[120px]"
                            >
                                <Plus className="w-8 h-8 mb-2" />
                                <span>여행지 추가하기</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Action */}
                <div className="p-6 border-t bg-gray-50">
                    <button 
                        onClick={handleSaveTrip}
                        disabled={isSaving}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex justify-center items-center shadow-lg"
                    >
                        {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                        여행지도 발행하기
                    </button>
                </div>
            </div>

            {/* Add Stop Modal */}
            {isAddingStop && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col md:flex-row">
                        {/* Map Picker Side */}
                        <div className="w-full md:w-1/2 h-64 md:h-full relative">
                            <MapContainer center={[currentStop.coordinates!.lat, currentStop.coordinates!.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                <LocationPicker onLocationSelect={handleLocationSelect} />
                            </MapContainer>
                            <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded-full text-xs font-semibold shadow-md z-[1000]">
                                지도를 클릭하여 위치 선택
                            </div>
                        </div>

                        {/* Form Side */}
                        <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">세부 일정 등록</h3>
                                <button onClick={() => setIsAddingStop(false)}><X /></button>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">장소 별칭 (Title)</label>
                                    <input 
                                        className="w-full border rounded-lg p-2" 
                                        value={currentStop.title}
                                        onChange={e => setCurrentStop({...currentStop, title: e.target.value})}
                                        placeholder="예: 파리 에펠탑에서의 저녁"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">지역명</label>
                                        <input 
                                            className="w-full border rounded-lg p-2" 
                                            value={currentStop.locationName}
                                            onChange={e => setCurrentStop({...currentStop, locationName: e.target.value})}
                                            placeholder="예: Paris, France"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">이동 수단(여기까지)</label>
                                        <select 
                                            className="w-full border rounded-lg p-2"
                                            value={currentStop.transportMode}
                                            onChange={e => setCurrentStop({...currentStop, transportMode: e.target.value as TransportMode})}
                                        >
                                            {Object.values(TransportMode).map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이야기 & 메모</label>
                                    <div className="relative">
                                        <textarea 
                                            className="w-full border rounded-lg p-3 pr-10 h-32 resize-none" 
                                            value={currentStop.description}
                                            onChange={e => setCurrentStop({...currentStop, description: e.target.value})}
                                            placeholder="여행의 순간을 기록하세요..."
                                        />
                                        <button 
                                            onClick={handleAiEnhance}
                                            disabled={isAiLoading}
                                            className="absolute bottom-3 right-3 p-2 bg-indigo-100 rounded-full text-indigo-600 hover:bg-indigo-200 transition-colors"
                                            title="AI로 글 다듬기"
                                        >
                                            {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 text-right flex justify-end items-center">
                                        <Wand2 className="w-3 h-3 mr-1" /> AI로 더 멋진 이야기 만들기
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">사진 등록</label>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={e => setStopImageFile(e.target.files ? e.target.files[0] : null)}
                                        className="w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-indigo-50 file:text-indigo-700
                                        hover:file:bg-indigo-100"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleAddStop}
                                className="mt-6 w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800"
                            >
                                이 장소 추가하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TripEditor;