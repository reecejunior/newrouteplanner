import React from 'react';
import { RouteStop } from '../types';
import { ArrowLeftIcon, CalculateIcon, RemoveIcon, DragHandleIcon } from './Icons';
import Spinner from './Spinner';

interface ReviewScreenProps {
  stops: RouteStop[];
  removeStop: (id: number) => void;
  reorderStops: (startIndex: number, endIndex: number) => void;
  calculateRoute: () => void;
  goBack: () => void;
  isLoading: boolean;
}

const ReviewScreen: React.FC<ReviewScreenProps> = ({
  stops,
  removeStop,
  reorderStops,
  calculateRoute,
  goBack,
  isLoading,
}) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault(); // This is necessary to allow dropping
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderStops(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    setDraggedIndex(null);
    e.currentTarget.style.opacity = '1';
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg animate-fade-in">
      <h2 className="text-2xl font-bold mb-1 text-content-100">Review Your Stops</h2>
      <p className="text-content-200 mb-6">Your route will start at the first stop and end at the last. Drag to reorder waypoints.</p>
      
      <ul className="space-y-3">
        {stops.map((stop, index) => (
          <li
            key={stop.id}
            draggable={!isLoading}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center justify-between p-4 rounded-lg transition-all duration-300 ${isLoading ? 'cursor-not-allowed bg-slate-200' : 'cursor-grab bg-light hover:bg-medium'}`}
          >
            <div className="flex items-center truncate">
              <DragHandleIcon className="w-6 h-6 text-dark mr-4 flex-shrink-0" />
              <span className="font-bold text-brand-text mr-3">{index + 1}.</span>
              <span className="text-content-100 truncate">{stop.address}</span>
            </div>
            <div className="flex items-center">
                {index === 0 && stops.length > 1 && (
                    <span className="text-xs font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded-md mr-3 whitespace-nowrap">Start</span>
                )}
                {index === stops.length - 1 && stops.length > 1 && (
                     <span className="text-xs font-bold uppercase text-red-700 bg-red-100 px-2 py-0.5 rounded-md mr-3 whitespace-nowrap">End</span>
                )}
                <button onClick={() => removeStop(stop.id)} className="text-dark hover:text-red-500 p-1 rounded-full transition ml-2" disabled={isLoading}>
                    <RemoveIcon className="w-5 h-5" />
                </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
        <button
          onClick={goBack}
          className="w-full sm:w-auto text-content-200 hover:text-brand-text font-bold py-3 px-6 rounded-lg flex items-center justify-center transition"
          disabled={isLoading}
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Edit
        </button>
        <button
          onClick={calculateRoute}
          className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary-dark text-brand-text font-bold py-3 px-8 rounded-lg flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Spinner />
              <span className="ml-3">Calculating Route...</span>
            </>
          ) : (
            <>
              <CalculateIcon className="w-5 h-5 mr-2" />
              Find Optimal Route
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ReviewScreen;