import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import Auth from './components/Auth';
import TripEditor from './components/TripEditor';
import StoryMap from './components/StoryMap';
import { Trip, TravelStop } from './types';
import { Plus, Map as MapIcon, LogOut, Loader2, Trash2, Edit, LogIn, Globe } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'EDITOR' | 'STORY' | 'AUTH'>('DASHBOARD');
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
      if (view === 'AUTH' && currentUser) {
        setView('DASHBOARD');
      }
    });
    return () => unsubscribe();
  }, [view]);

  // Initial Fetch
  useEffect(() => {
    fetchAllTrips();
  }, []);

  const fetchAllTrips = async () => {
    setLoading(true);
    try {
      // Fetch ALL trips for public viewing
      // Note: In production, you would want pagination and a compound index for sorting.
      // We use simple getDocs(collection) then sort client-side to avoid index errors during setup.
      const querySnapshot = await getDocs(collection(db, "trips"));
      const fetchedTrips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      
      // Sort by createdAt desc
      fetchedTrips.sort((a,b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
      });
      
      setTrips(fetchedTrips);
    } catch (e) {
      console.error("Fetch error", e);
      // Fail gracefully
      setTrips([]);
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
      alert("여행 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string) => {
      e.stopPropagation(); // Prevent card click
      if(!window.confirm("정말 이 여행 지도를 삭제하시겠습니까?")) return;

      try {
          await deleteDoc(doc(db, "trips", tripId));
          setTrips(trips.filter(t => t.id !== tripId));
      } catch (e) {
          alert("삭제 권한이 없거나 오류가 발생했습니다.");
      }
  }

  const handleEditTrip = async (e: React.MouseEvent, trip: Trip) => {
      e.stopPropagation();
      setLoading(true);
      try {
        const stopsData = await getTripStops(trip.id);
        setSelectedTrip(trip);
        setSelectedStops(stopsData);
        setIsEditing(true); 
        setView('EDITOR');
      } catch (e) {
          alert("데이터 로딩 실패");
      } finally {
          setLoading(false);
      }
  }

  const handleCreateComplete = () => {
    fetchAllTrips();
    setIsEditing(false);
    setSelectedTrip(null);
    setSelectedStops([]);
    setView('DASHBOARD');
  };

  const handleStartNewTrip = () => {
      if (!user) {
          if(window.confirm("여행을 기록하려면 로그인이 필요합니다. 로그인 하시겠습니까?")) {
            setView('AUTH');
          }
          return;
      }
      setIsEditing(false);
      setSelectedTrip(null);
      setSelectedStops([]);
      setView('EDITOR');
  }

  if (view === 'AUTH') {
      return (
          <div className="relative">
              <button 
                onClick={() => setView('DASHBOARD')}
                className="absolute top-4 left-4 z-50 text-white bg-black/50 p-2 rounded-full hover:bg-black/70"
              >
                  Close
              </button>
              <Auth />
          </div>
      );
  }

  // View: Story Map
  if (view === 'STORY' && selectedTrip) {
    return <StoryMap trip={selectedTrip} stops={selectedStops} onBack={() => setView('DASHBOARD')} />;
  }

  // View: Editor (Create or Edit)
  if (view === 'EDITOR' && user) {
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

  // View: Dashboard (Public)
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView('DASHBOARD')}>
              <MapIcon className="h-8 w-8 text-indigo-600 mr-2" />
              <span className="font-bold text-xl text-gray-900 tracking-tight">TravelLog AI</span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
                  <button 
                    onClick={() => signOut(auth)}
                    className="p-2 text-gray-400 hover:text-gray-500 flex items-center"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button 
                    onClick={() => setView('AUTH')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                    <LogIn className="w-4 h-4 mr-2" />
                    로그인
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-slate-900 overflow-hidden">
         <div className="absolute inset-0">
            <img className="w-full h-full object-cover opacity-30" src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=2835&auto=format&fit=crop" alt="Travel" />
         </div>
         <div className="relative max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl font-serif">
                당신의 여정을 지도로 남기세요
            </h1>
            <p className="mt-6 text-xl text-indigo-100 max-w-3xl mx-auto">
                AI가 만들어주는 매거진 스타일의 여행 지도. 전 세계 여행자들의 이야기를 탐험해보세요.
            </p>
         </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Globe className="w-6 h-6 mr-2 text-indigo-600" />
              최신 여행 로그
          </h2>
          <button 
            onClick={handleStartNewTrip}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            새 여행 기록하기
          </button>
        </div>

        {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
                 <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                 <p className="text-gray-500">여행 지도를 불러오는 중입니다...</p>
            </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">등록된 여행이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">첫 번째 여행자가 되어보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {trips.map((trip) => (
              <div 
                key={trip.id} 
                onClick={() => handleOpenTrip(trip)}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer border border-gray-100 flex flex-col h-full"
              >
                {/* Cover Image */}
                <div className="h-56 bg-gray-200 relative overflow-hidden">
                  <img 
                    src={`https://picsum.photos/seed/${trip.id}/800/600`} 
                    alt={trip.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80"></div>
                  
                  {/* Action Buttons - Only visible to owner */}
                  {user && user.uid === trip.userId && (
                      <div className="absolute top-3 right-3 flex space-x-2 z-10">
                          <button 
                            onClick={(e) => handleEditTrip(e, trip)}
                            className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-indigo-600 transition-colors"
                            title="수정"
                          >
                              <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteTrip(e, trip.id)}
                            className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-red-600 transition-colors"
                            title="삭제"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  )}

                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-xl font-serif font-bold leading-tight mb-1 group-hover:text-indigo-300 transition-colors">{trip.title}</h3>
                    <p className="text-xs opacity-70 font-mono">
                        {new Date(trip.createdAt.seconds * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4 font-light leading-relaxed">
                      {trip.description || "설명이 없습니다."}
                  </p>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-auto">
                     <span className="text-xs text-gray-400 font-mono">MAP ID: {trip.id.slice(0,6)}</span>
                     <span className="text-indigo-600 text-sm font-bold flex items-center group-hover:translate-x-1 transition-transform">
                        Explore <span className="ml-1">&rarr;</span>
                     </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
              &copy; 2024 TravelLog AI. All rights reserved.
          </div>
      </footer>
    </div>
  );
}

export default App;