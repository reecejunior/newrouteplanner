
export interface RouteStop {
  id: number;
  address: string;
  lat?: number;
  lng?: number;
  distance?: number; // in meters, to this stop from the previous one
  duration?: number; // in seconds, to this stop from the previous one
  directions?: string[]; // Turn-by-turn instructions to this stop
}

export enum AppView {
  INPUT = 'INPUT',
  REVIEW = 'REVIEW',
  RESULT = 'RESULT',
}

export interface RouteOption {
  label: string;
  description: string;
  totalDistance: number; // meters
  totalDuration: number; // seconds
  stops: {
    originalAddress: string;
    lat: number;
    lng: number;
  }[];
  optimizedOrder: number[]; // Array of original indices in the new optimized order
  legs: {
    distance: number; // meters
    duration: number; // seconds
    directions: string[];
  }[];
}

export type OptimizedRouteResponse = RouteOption[];

export interface PendingUpload {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  addresses?: string[];
  error?: string;
  timestamp: number;
  thumbnail?: string;
}