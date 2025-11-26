import { Timestamp } from 'firebase/firestore';

export enum TransportMode {
  FLIGHT = 'FLIGHT',
  TRAIN = 'TRAIN',
  CAR = 'CAR',
  BUS = 'BUS',
  WALK = 'WALK',
  SHIP = 'SHIP',
  BICYCLE = 'BICYCLE'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TravelStop {
  id: string;
  tripId: string;
  title: string;
  locationName: string;
  address: string;
  coordinates: Coordinates;
  arrivalDate: Timestamp | Date; // Allow Date for local forms before saving
  transportMode: TransportMode; // How the user arrived HERE from the previous point
  description: string;
  imageUrl?: string;
  order: number;
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  description: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  coverImage?: string;
  createdAt: Timestamp;
  isPublished: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
