
import React, { useState, useEffect } from 'react';
import { AppView, RouteStop, RouteOption, PendingUpload } from './types';
import { getRouteDetails } from './services/geminiService';
import { uploadQueue } from './utils/uploadQueue';
import { saveRouteToHistory, getRouteHistory, loadRouteFromHistory, SavedRoute } from './utils/routeHistory';
import AddressInputScreen from './components/AddressInputScreen';
import ReviewScreen from './components/ReviewScreen';
import RouteResultScreen from './components/RouteResultScreen';
import { LogoIcon } from './components/Icons';

const STORAGE_KEY = 'aiRoutePlannerPro_savedRoute';

export default function App() {
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [currentView, setCurrentView] = useState<AppView>(AppView.INPUT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRouteExists, setSavedRouteExists] = useState(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplashScreen(false);
    }, 2500); // Show splash for 2.5 seconds
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check for saved route in local storage
    try {
      const savedRoute = localStorage.getItem(STORAGE_KEY);
      if (savedRoute) {
        setSavedRouteExists(true);
      }
    } catch (e) {
      console.error("Could not read from local storage", e);
      setSavedRouteExists(false);
    }
  }, []);

  const handleImageUpload = (file: File) => {
    // Immediately add to queue - non-blocking
    const uploadId = uploadQueue.addUpload(file, (upload: PendingUpload) => {
      // Update pending uploads state
      setPendingUploads(prev => {
        const existing = prev.find(u => u.id === upload.id);
        if (existing) {
          return prev.map(u => u.id === upload.id ? upload : u);
        } else {
          return [...prev, upload];
        }
      });

      // When upload completes, add addresses to stops
      if (upload.status === 'completed' && upload.addresses && upload.addresses.length > 0) {
        const newStops: RouteStop[] = upload.addresses.map((address, index) => ({
          id: Date.now() + index + Math.random(),
          address,
        }));
        setStops(prevStops => [...prevStops, ...newStops]);
        
        // Auto-remove completed upload after 3 seconds
        setTimeout(() => {
          setPendingUploads(prev => prev.filter(u => u.id !== upload.id));
          uploadQueue.removeUpload(upload.id);
        }, 3000);
      }

      // Show error notification for failed uploads
      if (upload.status === 'failed') {
        setError(`Failed to extract addresses: ${upload.error || 'Unknown error'}`);
        setTimeout(() => setError(null), 5000);
      }
    });

    // Update state to show pending upload immediately
    const newUpload: PendingUpload = {
      id: uploadId,
      file,
      status: 'pending',
      timestamp: Date.now(),
      thumbnail: URL.createObjectURL(file),
    };
    setPendingUploads(prev => [...prev, newUpload]);
  };

  const retryUpload = (id: string) => {
    uploadQueue.retryUpload(id);
  };

  const dismissUpload = (id: string) => {
    setPendingUploads(prev => prev.filter(u => u.id !== id));
    uploadQueue.removeUpload(id);
  };

  const addStop = (address: string) => {
    if (address.trim()) {
      const newStop: RouteStop = { id: Date.now(), address };
      setStops(prevStops => [...prevStops, newStop]);
    }
  };

  const removeStop = (id: number) => {
    setStops(prevStops => prevStops.filter(stop => stop.id !== id));
  };

  const reorderStops = (startIndex: number, endIndex: number) => {
    const result = Array.from(stops);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setStops(result);
  };
  
  const clearStops = () => {
    setStops([]);
  }

  const proceedToReview = () => {
    if (stops.length >= 2) {
      setError(null);
      setCurrentView(AppView.REVIEW);
    } else {
      setError('Please add at least two stops to plan a route.');
    }
  };

  const calculateRoute = async (stopsToCalculate: RouteStop[] = stops) => {
    if (stopsToCalculate.length < 2) return;
    setIsLoading(true);
    setError(null);
    try {
      const addressList = stopsToCalculate.map(stop => stop.address);
      const routeDetailsArray = await getRouteDetails(addressList);
      
      if (!routeDetailsArray || routeDetailsArray.length === 0) {
        throw new Error("No valid routes were returned. Please check the addresses.");
      }

      setRouteOptions(routeDetailsArray);
      setSelectedRouteIndex(0);
      setCurrentView(AppView.RESULT);
    } catch (err) {
      console.error(err);
      setError('Failed to calculate the route. The addresses might be invalid or too far apart. Please review and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addStopToRoute = async (address: string) => {
    if (!address.trim()) return;
    const newStop: RouteStop = { id: Date.now(), address };
    const stopsForRecalculation = [...stops, newStop];
    setStops(stopsForRecalculation);
    await calculateRoute(stopsForRecalculation);
  };
  
  const startOver = () => {
    setStops([]);
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setError(null);
    setCurrentView(AppView.INPUT);
  };

  const selectRoute = (index: number) => {
    setSelectedRouteIndex(index);
  }

  const getStopsForDisplay = (option: RouteOption, originalStops: RouteStop[]): RouteStop[] => {
    if (!option) return [];
    return option.optimizedOrder.map((originalIndex, newIndex) => {
        const baseStop = originalStops.find(s => s.address === option.stops[originalIndex].originalAddress) || originalStops[originalIndex];
        const details = option.stops[originalIndex];
        const leg = option.legs[newIndex - 1];
        return {
            id: baseStop.id,
            address: details.originalAddress,
            lat: details.lat,
            lng: details.lng,
            distance: leg?.distance,
            duration: leg?.duration,
            directions: leg?.directions,
        };
    });
  };

  const saveRoute = () => {
    if (!routeOptions[selectedRouteIndex]) return;
    const stopsToSave = getStopsForDisplay(routeOptions[selectedRouteIndex], stops);
    const routeOption = routeOptions[selectedRouteIndex];
    
    try {
      // Save to legacy storage for backward compatibility
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stopsToSave));
      setSavedRouteExists(true);
      
      // Also save to history with auto-generated name
      const routeName = `Route ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      saveRouteToHistory(routeName, stopsToSave, routeOption);
    } catch (e) {
      console.error("Could not save route to local storage", e);
      setError("Failed to save the route.");
    }
  };

  const saveRouteAs = (name: string) => {
    if (!routeOptions[selectedRouteIndex]) return;
    const stopsToSave = getStopsForDisplay(routeOptions[selectedRouteIndex], stops);
    const routeOption = routeOptions[selectedRouteIndex];
    
    try {
      saveRouteToHistory(name, stopsToSave, routeOption);
      setError(null);
    } catch (e) {
      console.error("Could not save route to history", e);
      setError("Failed to save the route.");
    }
  };

  const loadRoute = () => {
    try {
      const savedRouteJSON = localStorage.getItem(STORAGE_KEY);
      if (savedRouteJSON) {
        const savedStops = JSON.parse(savedRouteJSON);
        if (Array.isArray(savedStops) && savedStops.length > 0) {
          // A loaded route won't have options, so we create a mock single option
          const totalDistance = savedStops.reduce((sum, stop) => sum + (stop.distance || 0), 0);
          const totalDuration = savedStops.reduce((sum, stop) => sum + (stop.duration || 0), 0);
          
          const mockRouteOption: RouteOption = {
            label: "Saved Route",
            description: "Loaded from your last session.",
            totalDistance,
            totalDuration,
            stops: savedStops.map(s => ({ originalAddress: s.address, lat: s.lat!, lng: s.lng! })),
            optimizedOrder: savedStops.map((_, index) => index),
            legs: savedStops.slice(1).map(s => ({
              distance: s.distance!,
              duration: s.duration!,
              directions: s.directions || [],
            }))
          }
          
          setStops(savedStops);
          setRouteOptions([mockRouteOption]);
          setSelectedRouteIndex(0);
          setCurrentView(AppView.RESULT);
        } else {
          throw new Error("Invalid route data in storage.");
        }
      }
    } catch (e) {
      console.error("Could not load route from local storage", e);
      setError("Failed to load the saved route. It may be corrupted.");
      // Clean up corrupted data
      localStorage.removeItem(STORAGE_KEY);
      setSavedRouteExists(false);
    }
  };


  return (
    <>
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-brand-text transition-opacity duration-700 ease-out ${showSplashScreen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <LogoIcon className="w-48 h-48 text-brand-primary animate-glow" />
      </div>

      <div className="app-background min-h-screen flex flex-col items-center">
        <header className="sticky top-0 z-40 w-full backdrop-blur-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-start p-4 sm:p-6">
              <LogoIcon className="w-10 h-10 text-brand-primary-dark" />
              <h1 className="text-3xl font-heading font-bold ml-3 text-light tracking-tight">
                AI Route Planner
              </h1>
          </div>
        </header>
        <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          {currentView === AppView.INPUT && (
            <AddressInputScreen
              stops={stops}
              addStop={addStop}
              removeStop={removeStop}
              handleImageUpload={handleImageUpload}
              proceedToReview={proceedToReview}
              isLoading={isLoading}
              clearStops={clearStops}
              loadRoute={loadRoute}
              savedRouteExists={savedRouteExists}
              pendingUploads={pendingUploads}
              retryUpload={retryUpload}
              dismissUpload={dismissUpload}
            />
          )}
          {currentView === AppView.REVIEW && (
            <ReviewScreen
              stops={stops}
              removeStop={removeStop}
              reorderStops={reorderStops}
              calculateRoute={() => calculateRoute()}
              goBack={() => setCurrentView(AppView.INPUT)}
              isLoading={isLoading}
            />
          )}
          {currentView === AppView.RESULT && (
            <RouteResultScreen
              routeOptions={routeOptions}
              selectedRouteIndex={selectedRouteIndex}
              selectRoute={selectRoute}
              displayedStops={getStopsForDisplay(routeOptions[selectedRouteIndex], stops)}
              startOver={startOver}
              addStopToRoute={addStopToRoute}
              isLoading={isLoading}
              saveRoute={saveRoute}
              saveRouteAs={saveRouteAs}
            />
          )}
        </main>
      </div>
    </>
  );
}