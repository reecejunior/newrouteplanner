import React, { useEffect, useRef, useState, useMemo } from 'react';
import { RouteStop, RouteOption } from '../types';
import { formatDistance, formatDuration } from '../utils/helpers';
import { StartOverIcon, CarIcon, ClockIcon, TotalIcon, DirectionsIcon, ChevronDownIcon, AddIcon, SaveIcon } from './Icons';
import Spinner from './Spinner';

// Add google to the window interface to avoid TypeScript errors
declare global {
  interface Window {
    google: any;
  }
}

interface RouteResultScreenProps {
  routeOptions: RouteOption[];
  selectedRouteIndex: number;
  selectRoute: (index: number) => void;
  displayedStops: RouteStop[];
  startOver: () => void;
  addStopToRoute: (address: string) => Promise<void>;
  isLoading: boolean;
  saveRoute: () => void;
}

const DirectionsList: React.FC<{ directions: string[] }> = ({ directions }) => (
    <div className="mt-3 ml-1 pl-4 border-l-2 border-brand-primary/50">
        <ol className="list-decimal list-inside space-y-2 text-content-200 text-sm">
            {directions.map((dir, i) => <li key={i} className="pl-2">{dir}</li>)}
        </ol>
    </div>
);

type BadgeColor = 'green' | 'blue' | 'yellow' | 'red';

const ComparisonBadge: React.FC<{ text: string; color: BadgeColor }> = ({ text, color }) => {
  const colorClasses: Record<BadgeColor, string> = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`${colorClasses[color]} text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap`}>
      {text}
    </span>
  );
};


const RouteResultScreen: React.FC<RouteResultScreenProps> = ({ 
  routeOptions, 
  selectedRouteIndex, 
  selectRoute, 
  displayedStops, 
  startOver, 
  addStopToRoute, 
  isLoading, 
  saveRoute 
}) => {
  const selectedRoute = routeOptions[selectedRouteIndex];
  const totalDistance = selectedRoute?.totalDistance || 0;
  const totalDuration = selectedRoute?.totalDuration || 0;

  const mapRef = useRef<HTMLDivElement>(null);
  const [openDirections, setOpenDirections] = useState<number | null>(null);
  const [newStopAddress, setNewStopAddress] = useState('');
  const [saveButtonText, setSaveButtonText] = useState('Save Route');

  const comparisonStats = useMemo(() => {
    if (routeOptions.length <= 1) {
      return null;
    }

    const durations = routeOptions.map(o => o.totalDuration);
    const distances = routeOptions.map(o => o.totalDistance);

    return {
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      minDistance: Math.min(...distances),
      maxDistance: Math.max(...distances),
    };
  }, [routeOptions]);

  const toggleDirections = (stopId: number) => {
    setOpenDirections(prev => (prev === stopId ? null : stopId));
  };

  const handleAddStop = async () => {
    if (!newStopAddress.trim()) return;
    await addStopToRoute(newStopAddress);
    setNewStopAddress('');
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddStop();
    }
  };

  const handleSaveRoute = () => {
    saveRoute();
    setSaveButtonText('Route Saved!');
    const timer = setTimeout(() => {
      setSaveButtonText('Save Route');
    }, 3000);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    // Reset save button text if stops/route change
    setSaveButtonText('Save Route');
  }, [displayedStops]);

  useEffect(() => {
    if (!mapRef.current || !window.google || displayedStops.length === 0 || !displayedStops[0].lat) {
      return;
    }
    
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: displayedStops[0].lat, lng: displayedStops[0].lng },
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      mapId: 'ROUTE_PLANNER_MAP'
    });

    const bounds = new window.google.maps.LatLngBounds();
    const pathCoordinates = displayedStops.map((stop, index) => {
      const position = { lat: stop.lat!, lng: stop.lng! };
      
      const pinGlyph = new window.google.maps.marker.PinElement({
        glyph: (index + 1).toString(),
        glyphColor: "#111827",
        background: "#a3e635",
        borderColor: "#111827",
      });

      new window.google.maps.marker.AdvancedMarkerElement({
        position,
        map,
        title: `${index + 1}. ${stop.address}`,
        content: pinGlyph.element,
      });

      bounds.extend(position);
      return position;
    });

    if (displayedStops.length > 1) {
        map.fitBounds(bounds);
    }

    const routePath = new window.google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#111827",
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });

    routePath.setMap(map);

  }, [displayedStops]);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-content-100">Your Optimized Route</h2>
            <p className="text-content-200">The most efficient path has been calculated for you.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
             <button
                onClick={handleSaveRoute}
                disabled={isLoading || saveButtonText === 'Route Saved!'}
                className="bg-brand-primary hover:bg-brand-primary-dark text-brand-text font-bold py-2 px-4 rounded-lg flex items-center transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <SaveIcon className="w-5 h-5 mr-2" />
                {saveButtonText}
            </button>
            <button
              onClick={startOver}
              disabled={isLoading}
              className="bg-white hover:bg-medium text-content-100 border border-medium font-bold py-2 px-4 rounded-lg flex items-center transition disabled:opacity-50"
            >
              <StartOverIcon className="w-5 h-5 mr-2" />
              Start New Route
            </button>
        </div>
      </div>
      
      {routeOptions.length > 1 && (
        <div className="mb-8">
            <h3 className="text-lg font-bold text-content-100 mb-3">Choose Your Route</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {routeOptions.map((option, index) => {
                    const badges: React.ReactNode[] = [];
                    if (comparisonStats) {
                        if (option.totalDuration === comparisonStats.minDuration) {
                            badges.push(<ComparisonBadge key="fastest" text="Fastest" color="green" />);
                        }
                        if (option.totalDistance === comparisonStats.minDistance) {
                            badges.push(<ComparisonBadge key="shortest" text="Shortest" color="blue" />);
                        }
                        if (routeOptions.length > 2) {
                            if (option.totalDuration === comparisonStats.maxDuration) {
                                badges.push(<ComparisonBadge key="slowest" text="Slowest" color="yellow" />);
                            }
                            if (option.totalDistance === comparisonStats.maxDistance) {
                                badges.push(<ComparisonBadge key="longest" text="Longest" color="red" />);
                            }
                        }
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => selectRoute(index)}
                            disabled={isLoading}
                            className={`p-4 rounded-lg border-2 text-left transition-all duration-200 w-full flex flex-col justify-between disabled:opacity-50 ${
                                selectedRouteIndex === index
                                    ? 'bg-brand-primary/20 border-brand-primary shadow-lg scale-105'
                                    : 'bg-white hover:bg-light hover:border-dark border-medium'
                            }`}
                        >
                            <div>
                                <div className="flex items-center flex-wrap gap-y-2">
                                    <p className="font-bold text-brand-text mr-2">{option.label}</p>
                                    <div className="flex items-center gap-1.5">
                                        {badges}
                                    </div>
                                </div>
                                <p className="text-sm text-content-200 mt-2">{option.description}</p>
                            </div>
                            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-200 text-sm font-semibold text-content-100">
                               <div className="flex items-center">
                                    <ClockIcon className="w-4 h-4 mr-1.5 text-dark"/>
                                    <span>{formatDuration(option.totalDuration)}</span>
                                </div>
                                <div className="flex items-center">
                                    <CarIcon className="w-4 h-4 mr-1.5 text-dark"/>
                                    <span>{formatDistance(option.totalDistance)}</span>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
      )}


      <div className="flex flex-col lg:flex-row gap-8">
        {/* Route Details */}
        <div className="w-full lg:w-3/5 xl:w-2/3">
            <div className="bg-white rounded-2xl shadow-lg">
                {/* Map */}
                <div className="w-full h-72 md:h-96 rounded-t-2xl overflow-hidden bg-medium">
                    <div ref={mapRef} className="w-full h-full" aria-label="Route map"/>
                </div>
                 {/* Stops List */}
                <div className="p-4 sm:p-6 relative max-h-[75vh] overflow-y-auto">
                    {displayedStops.map((stop, index) => (
                    <div key={stop.id} className="relative pl-12 pb-8">
                        {/* Vertical line */}
                        {index < displayedStops.length - 1 &&
                            <div className="absolute left-6 top-5 h-full w-0.5 bg-medium"></div>
                        }

                        {/* Circle */}
                        <div className="absolute left-0 top-0 w-12 h-12 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-brand-text text-white flex items-center justify-center font-bold z-10">
                                {index + 1}
                            </div>
                        </div>

                        <div className="pl-4">
                            <h3 className="font-bold text-lg text-content-100 flex items-start pt-1">
                                <span>{stop.address}</span>
                            </h3>
                            {index > 0 && stop.distance !== undefined && stop.duration !== undefined && (
                                <div className="mt-2 text-sm text-content-200 space-y-2">
                                    <div className='flex items-center gap-4 flex-wrap'>
                                    <div className="flex items-center" title="Distance">
                                        <CarIcon className="w-4 h-4 mr-1.5 text-dark"/>
                                        <span className="font-semibold">{formatDistance(stop.distance)}</span>
                                    </div>
                                    <div className="flex items-center" title="Duration">
                                        <ClockIcon className="w-4 h-4 mr-1.5 text-dark"/>
                                        <span className="font-semibold">{formatDuration(stop.duration)}</span>
                                    </div>
                                    </div>
                                    {stop.directions && stop.directions.length > 0 && (
                                        <button onClick={() => toggleDirections(stop.id)} className="flex items-center gap-1 text-dark hover:text-brand-text font-semibold pt-1">
                                            <DirectionsIcon className="w-4 h-4"/>
                                            <span>{openDirections === stop.id ? 'Hide' : 'Show'} Directions</span>
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${openDirections === stop.id ? 'rotate-180' : ''}`} />
                                        </button>
                                    )}
                                </div>
                            )}
                            {openDirections === stop.id && stop.directions && (
                                <DirectionsList directions={stop.directions} />
                            )}
                        </div>
                    </div>
                    ))}
                    {isLoading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-b-2xl">
                        <Spinner />
                        <span className="ml-3 text-lg font-semibold">Recalculating...</span>
                    </div>
                    )}
                </div>
            </div>
        </div>

        {/* Totals Summary */}
        <div className="w-full lg:w-2/5 xl:w-1/3">
          <div className="bg-white p-6 rounded-2xl shadow-lg sticky top-6">
            <h3 className="text-xl font-bold mb-5 flex items-center text-content-100"><TotalIcon className="w-6 h-6 mr-3 text-brand-primary"/>Route Summary</h3>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-content-200">Total Stops</p>
                <p className="text-3xl font-bold text-brand-text">{displayedStops.length}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-content-200">Total Distance</p>
                <p className="text-3xl font-bold text-brand-text">{formatDistance(totalDistance)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-content-200">Est. Total Duration</p>
                <p className="text-3xl font-bold text-brand-text">{formatDuration(totalDuration)}</p>
              </div>
            </div>

            <div className="border-t border-medium mt-6 pt-6">
                <h4 className="font-semibold mb-3 text-content-100">Add Another Stop</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newStopAddress}
                        onChange={(e) => setNewStopAddress(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter address"
                        className="flex-grow w-full bg-light border border-medium text-content-100 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:outline-none transition"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleAddStop}
                        className="flex-shrink-0 bg-brand-primary hover:bg-brand-primary-dark text-brand-text font-bold p-2.5 rounded-lg flex items-center justify-center transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={!newStopAddress.trim() || isLoading}
                        title="Add stop and recalculate"
                    >
                        <AddIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteResultScreen;