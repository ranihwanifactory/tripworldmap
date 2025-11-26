import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Auth from './components/Auth';
import TripEditor from './components/TripEditor';
import StoryMap from './components/StoryMap';
import { Trip, TravelStop } from './types';
import { Plus, Map as MapIcon, LogOut, Loader2, Trash2, Edit } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'EDITOR' | 'STORY'>('DASHBOARD');
  const [trips, setTrips] = useState<Trip[]>([]);
  
  // State for Selection
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedStops, setSelectedStops] = useState<TravelStop[]>([]);
  
  // State specifically for Editing
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchTrips(currentUser.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchTrips = async (uid: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, "trips"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const fetchedTrips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      // Sort client side by createdAt desc
      fetchedTrips.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
      setTrips(fetchedTrips);
    } catch (e) {
      console.error("Fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const getTripStops = async (tripId: string) => {
      const stopsRef = collection(db, `trips/${tripId}/stops`);
      const snapshot = await getDocs(stopsRef); 
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TravelStop));
  }

  const handleOpenTrip = async (trip: Trip) => {
    setLoading(true);
    try {
      const stopsData = await getTripStops(trip.id);
      setSelectedTrip(trip);
      setSelectedStops(stopsData);
      setView('STORY');
    } catch (e) {
      console.error(e);
      alert("Error loading trip details");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string) => {
      e.stopPropagation(); // Prevent card click
      if(!window.confirm("정말 이 여행 지도를 삭제하시겠습니까?")) return;

      try {
          await deleteDoc(doc(db, "trips", tripId));
          // Note: Subcollections (stops) are not automatically deleted in client SDK.
          // For a production app, use a Cloud Function. For now, we hide the trip.
          setTrips(trips.filter(t => t.id !== tripId));
      } catch (e) {
          alert("삭제 중 오류가 발생했습니다.");
      }
  }

  const handleEditTrip = async (e: React.MouseEvent, trip: Trip) => {
      e.stopPropagation();
      setLoading(true);
      try {
        const stopsData = await getTripStops(trip.id);
        setSelectedTrip(trip);
        setSelectedStops(stopsData);
        setIsEditing(true); // Flag to tell Editor to preload data
        setView('EDITOR');
      } catch (e) {
          alert("데이터 로딩 실패");
      } finally {
          setLoading(false);
      }
  }

  const handleCreateComplete = () => {
    if (user) fetchTrips(user.uid);
    setIsEditing(false);
    setSelectedTrip(null);
    setSelectedStops([]);
    setView('DASHBOARD');
  };

  const handleStartNewTrip = () => {
      setIsEditing(false);
      setSelectedTrip(null);
      setSelectedStops([]);
      setView('EDITOR');
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">여행 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // View: Story Map
  if (view === 'STORY' && selectedTrip) {
    return <StoryMap trip={selectedTrip} stops={selectedStops} onBack={() => setView('DASHBOARD')} />;
  }

  // View: Editor (Create or Edit)
  if (view === 'EDITOR') {
    return (
        <TripEditor 
            userId={user.uid} 
            onClose={() => setView('DASHBOARD')} 
            onSaveComplete={handleCreateComplete} 
            tripId={isEditing && selectedTrip ? selectedTrip.id : undefined}
            initialTripData={isEditing && selectedTrip ? selectedTrip : undefined}
            initialStops={isEditing ? selectedStops : undefined}
        />
    );
  }

  // View: Dashboard
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <MapIcon className="h-8 w-8 text-indigo-600 mr-2" />
              <span className="font-bold text-xl text-gray-900">TravelLog AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-gray-400 hover:text-gray-500"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">나의 여행 지도</h1>
          <button 
            onClick={handleStartNewTrip}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            새 여행 기록하기
          </button>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">여행 기록이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">새로운 모험을 떠나고 기록해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div 
                key={trip.id} 
                onClick={() => handleOpenTrip(trip)}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer border border-gray-100"
              >
                <div className="h-48 bg-gray-200 relative overflow-hidden">
                  <img 
                    src={`https://picsum.photos/seed/${trip.id}/800/600`} 
                    alt={trip.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleEditTrip(e, trip)}
                        className="p-2 bg-white/90 backdrop-blur rounded-full text-gray-700 hover:text-indigo-600 hover:bg-white transition-colors"
                        title="수정"
                      >
                          <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteTrip(e, trip.id)}
                        className="p-2 bg-white/90 backdrop-blur rounded-full text-gray-700 hover:text-red-600 hover:bg-white transition-colors"
                        title="삭제"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>

                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-lg font-bold">{trip.title}</h3>
                    <p className="text-xs opacity-80">{new Date(trip.createdAt.seconds * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 line-clamp-2">{trip.description}</p>
                  <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium">
                     지도 보기 &rarr;
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;