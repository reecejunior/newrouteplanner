
import React, { useState, useEffect } from 'react';
import { AppView, RouteStop, RouteOption } from './types';
import { extractAddressesFromImage, getRouteDetails } from './services/geminiService';
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
  const [isMapsKeyInvalid, setIsMapsKeyInvalid] = useState(false);
  const [savedRouteExists, setSavedRouteExists] = useState(false);

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

    // Check if the placeholder API key is still present in the script tag.
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src;
        if (src.includes('maps.googleapis.com/maps/api/js') && src.includes('YOUR_API_KEY_HERE')) {
            setIsMapsKeyInvalid(true);
            break;
        }
    }
  }, []);

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = (reader.result as string).split(',')[1];
        const addresses = await extractAddressesFromImage(base64Image, file.type);
        const newStops: RouteStop[] = addresses.map((address, index) => ({
          id: Date.now() + index,
          address,
        }));
        setStops(prevStops => [...prevStops, ...newStops]);
        setIsLoading(false);
      };
      reader.onerror = () => {
        throw new Error('Failed to read file.');
      };
    } catch (err) {
      setError('Could not extract addresses from image. Please try again.');
      setIsLoading(false);
    }
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stopsToSave));
      setSavedRouteExists(true);
    } catch (e) {
      console.error("Could not save route to local storage", e);
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
    <div className="min-h-screen bg-light flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-5xl mx-auto flex items-center justify-start mb-8">
        <LogoIcon className="w-10 h-10 text-brand-text" />
        <h1 className="text-2xl font-bold ml-3 text-brand-text tracking-tight">
          Route Planner
        </h1>
      </header>
      <main className="w-full max-w-5xl mx-auto">
        {isMapsKeyInvalid && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg" role="alert">
            <p className="font-bold">Configuration Required</p>
            <p>The Google Maps API key is missing. Please replace <code className="font-mono bg-yellow-200 p-1 rounded">YOUR_API_KEY_HERE</code> in the <code className="font-mono bg-yellow-200 p-1 rounded">index.html</code> file with a valid key to enable map functionality.</p>
          </div>
        )}
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
          />
        )}
      </main>
    </div>
  );
}
