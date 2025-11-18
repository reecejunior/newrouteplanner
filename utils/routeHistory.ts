import { RouteStop, RouteOption } from '../types';

export interface SavedRoute {
  id: string;
  name: string;
  timestamp: number;
  isFavorite: boolean;
  stops: RouteStop[];
  routeOption?: RouteOption;
}

const STORAGE_KEY = 'aiRoutePlannerPro_routeHistory';
const MAX_HISTORY = 50; // Maximum number of saved routes

export function saveRouteToHistory(
  name: string,
  stops: RouteStop[],
  routeOption?: RouteOption
): string {
  const history = getRouteHistory();
  
  const newRoute: SavedRoute = {
    id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    timestamp: Date.now(),
    isFavorite: false,
    stops,
    routeOption,
  };

  history.unshift(newRoute); // Add to beginning
  
  // Keep only the most recent routes
  if (history.length > MAX_HISTORY) {
    history.splice(MAX_HISTORY);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return newRoute.id;
  } catch (error) {
    console.error('Failed to save route to history:', error);
    throw new Error('Failed to save route. Storage may be full.');
  }
}

export function getRouteHistory(): SavedRoute[] {
  try {
    const historyJson = localStorage.getItem(STORAGE_KEY);
    if (!historyJson) return [];
    
    const history = JSON.parse(historyJson);
    if (!Array.isArray(history)) return [];
    
    // Sort by favorite first, then by timestamp (newest first)
    return history.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.timestamp - a.timestamp;
    });
  } catch (error) {
    console.error('Failed to load route history:', error);
    return [];
  }
}

export function getFavoriteRoutes(): SavedRoute[] {
  return getRouteHistory().filter(route => route.isFavorite);
}

export function loadRouteFromHistory(id: string): SavedRoute | null {
  const history = getRouteHistory();
  return history.find(route => route.id === id) || null;
}

export function deleteRouteFromHistory(id: string): boolean {
  const history = getRouteHistory();
  const filtered = history.filter(route => route.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Failed to delete route from history:', error);
    return false;
  }
}

export function toggleFavorite(id: string): boolean {
  const history = getRouteHistory();
  const route = history.find(r => r.id === id);
  
  if (!route) return false;
  
  route.isFavorite = !route.isFavorite;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return route.isFavorite;
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return false;
  }
}

export function updateRouteName(id: string, newName: string): boolean {
  const history = getRouteHistory();
  const route = history.find(r => r.id === id);
  
  if (!route) return false;
  
  route.name = newName;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error('Failed to update route name:', error);
    return false;
  }
}

