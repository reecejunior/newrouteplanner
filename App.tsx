import React, { useState, useEffect, useRef } from 'react';
import { AppView, RouteStop, RouteOption } from './types';
import { extractAddressesFromImage, getRouteDetails } from './services/geminiService';
import AddressInputScreen from './components/AddressInputScreen';
import ReviewScreen from './components/ReviewScreen';
import RouteResultScreen from './components/RouteResultScreen';
import { LogoIcon, AddIcon, RemoveIcon } from './components/Icons';

// Add google to the window interface to avoid TypeScript errors
declare global {
  interface Window {
    google: any;
  }
}

// Sub-component for an input with Google Places Autocomplete
const AutocompleteInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocomplete = useRef<any>(null);

  useEffect(() => {
    if (window.google && inputRef.current && !autocomplete.current) {
      autocomplete.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['address'],
          componentRestrictions: { 'country': ['US', 'CA', 'GB', 'AU', 'DE', 'FR'] },
          fields: ['formatted_address']
        }
      );

      autocomplete.current.addListener('place_changed', () => {
        const place = autocomplete.current.getPlace();
        if (place && place.formatted_address) {
          onChange(place.formatted_address);
        }
      });
    }
  }, [onChange]);
  
  // To handle manual edits that don't use autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      className="flex-grow w-full bg-light border border-medium text-content-100 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:outline-none transition"
    />
  );
};


// Modal component for reviewing OCR results
const OcrReviewModal: React.FC<{
  results: string[];
  onConfirm: (addresses: string[]) => void;
  onCancel: () => void;
}> = ({ results, onConfirm, onCancel }) => {
  const [editedAddresses, setEditedAddresses] = useState<string[]>(results);

  const handleAddressChange = (index: number, newValue: string) => {
    const newAddresses = [...editedAddresses];
    newAddresses[index] = newValue;
    setEditedAddresses(newAddresses);
  };

  const removeAddress = (index: number) => {
    setEditedAddresses(editedAddresses.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onConfirm(editedAddresses.filter(addr => addr.trim() !== ''));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-6 sm:p-8 animate-slide-in-up">
        <h2 className="text-2xl font-bold font-heading mb-2 text-content-100">Review Extracted Addresses</h2>
        <p className="text-content-200 mb-6">Correct any errors and remove incorrect entries before adding them to your route.</p>
        
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {editedAddresses.map((address, index) => (
            <div key={index} className="flex items-center gap-3">
              <AutocompleteInput 
                value={address}
                onChange={newValue => handleAddressChange(index, newValue)}
                placeholder="Enter or correct address"
              />
              <button
                onClick={() => removeAddress(index)}
                className="text-dark hover:text-red-500 p-2 rounded-full transition flex-shrink-0"
                aria-label="Remove address"
              >
                <RemoveIcon className="w-6 h-6" />
              </button>
            </div>
          ))}
        </div>
        
        {editedAddresses.length === 0 && (
          <div className="text-center py-8 text-content-200">
            <p>No addresses to review.</p>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto text-content-200 hover:bg-medium font-bold py-3 px-6 rounded-lg flex items-center justify-center transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="w-full sm:w-auto bg-gradient-primary text-brand-text font-bold py-3 px-8 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
          >
            <AddIcon className="w-5 h-5 mr-2" />
            Add Stops
          </button>
        </div>
      </div>
    </div>
  );
};


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
  const [ocrResults, setOcrResults] = useState<string[] | null>(null);

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

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = (reader.result as string).split(',')[1];
        const addresses = await extractAddressesFromImage(base64Image, file.type);
        if (addresses.length > 0) {
            setOcrResults(addresses);
        } else {
            setError("No addresses could be found in the image.");
        }
        setIsLoading(false);
      };
      reader.onerror = () => {
        setIsLoading(false);
        throw new Error('Failed to read file.');
      };
    } catch (err) {
      setError('Could not extract addresses from image. Please try again.');
      setIsLoading(false);
    }
  };

  const handleConfirmOcrStops = (confirmedAddresses: string[]) => {
    const newStops: RouteStop[] = confirmedAddresses.map((address, index) => ({
      id: Date.now() + index,
      address,
    }));
    // Filter out duplicates that might already be in the list
    const uniqueNewStops = newStops.filter(newStop => !stops.some(existingStop => existingStop.address === newStop.address));
    setStops(prevStops => [...prevStops, ...uniqueNewStops]);
    setOcrResults(null);
  };
  
  const handleCancelOcr = () => {
    setOcrResults(null);
  };

  const addStop = (address: string) => {
    if (address.trim() && !stops.some(stop => stop.address === address.trim())) {
      const newStop: RouteStop = { id: Date.now(), address: address.trim() };
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

  const renderView = () => {
    switch (currentView) {
      case AppView.REVIEW:
        return (
          <ReviewScreen
            stops={stops}
            removeStop={removeStop}
            reorderStops={reorderStops}
            calculateRoute={() => calculateRoute()}
            goBack={() => setCurrentView(AppView.INPUT)}
            isLoading={isLoading}
          />
        );
      case AppView.RESULT:
        return (
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
        );
      case AppView.INPUT:
      default:
        return (
          <AddressInputScreen
            stops={stops}
            addStop={addStop}
            removeStop={removeStop}
            clearStops={clearStops}
            handleImageUpload={handleImageUpload}
            proceedToReview={proceedToReview}
            isLoading={isLoading}
            savedRouteExists={savedRouteExists}
            loadRoute={loadRoute}
          />
        );
    }
  };

  return (
    <>
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-brand-text transition-opacity duration-700 ease-in-out ${showSplashScreen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="relative">
              <LogoIcon className="w-32 h-32 text-brand-primary animate-pulse-slow" />
              <h1 className="sr-only">AI Route Planner Pro</h1>
          </div>
      </div>

      {ocrResults && (
        <OcrReviewModal 
          results={ocrResults}
          onConfirm={handleConfirmOcrStops}
          onCancel={handleCancelOcr}
        />
      )}

      <div className={`app-background min-h-screen p-4 sm:p-6 md:p-8 flex justify-center items-start ${showSplashScreen ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000 ease-in-out'}`}>
        <main className="w-full max-w-5xl mx-auto">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6 animate-fade-in" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
              <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
              </button>
            </div>
          )}
          {renderView()}
        </main>
      </div>
    </>
  );
}