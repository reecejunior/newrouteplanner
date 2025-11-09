import React, { useState, useRef } from 'react';
import { RouteStop } from '../types';
import { UploadIcon, AddIcon, RemoveIcon, ArrowRightIcon, TrashIcon, RestoreIcon } from './Icons';
import Spinner from './Spinner';
import Banner from './Banner';

interface AddressInputScreenProps {
  stops: RouteStop[];
  addStop: (address: string) => void;
  removeStop: (id: number) => void;
  clearStops: () => void;
  handleImageUpload: (file: File) => void;
  proceedToReview: () => void;
  isLoading: boolean;
  savedRouteExists: boolean;
  loadRoute: () => void;
}

const AddressInputScreen: React.FC<AddressInputScreenProps> = ({
  stops,
  addStop,
  removeStop,
  clearStops,
  handleImageUpload,
  proceedToReview,
  isLoading,
  savedRouteExists,
  loadRoute
}) => {
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = () => {
    addStop(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddClick();
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      handleImageUpload(event.target.files[0]);
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <Banner />
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 p-6 sm:p-8 rounded-2xl shadow-lg animate-fade-in">
        <h2 className="text-2xl font-bold font-heading mb-1 text-content-100">Plan Your Route</h2>
        <p className="text-content-200 mb-6">Add stops manually or by uploading an image.</p>
        
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter a new address"
            className="flex-grow w-full bg-light border border-medium text-content-100 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:outline-none transition"
            disabled={isLoading}
          />
          <div className="flex gap-3">
              <button
                onClick={handleAddClick}
                className="flex-grow sm:flex-grow-0 bg-brand-text hover:opacity-90 text-white font-semibold py-3 px-5 rounded-lg flex items-center justify-center transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={!inputValue.trim() || isLoading}
              >
                <AddIcon className="w-5 h-5 mr-2" />
                Add Stop
              </button>
              <button
                onClick={onUploadClick}
                className="flex-grow sm:flex-grow-0 bg-medium hover:bg-slate-300 text-content-100 font-semibold py-3 px-5 rounded-lg flex items-center justify-center transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                <UploadIcon className="w-5 h-5 mr-2" />
                Upload
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                className="hidden"
                accept="image/*"
                disabled={isLoading}
              />
          </div>
        </div>

        {savedRouteExists && (
          <div className="my-6 text-center border-t border-b border-medium py-4">
              <button
                  onClick={loadRoute}
                  disabled={isLoading}
                  className="text-brand-text font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition hover:bg-medium mx-auto disabled:opacity-50"
              >
                  <RestoreIcon className="w-5 h-5 mr-2" />
                  Load Previously Saved Route
              </button>
          </div>
        )}

        <div className="mt-8">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-content-100">Your Stops ({stops.length})</h3>
              {stops.length > 0 && 
                <button onClick={clearStops} className="text-sm text-content-200 hover:text-red-500 flex items-center gap-1 transition-colors font-medium" disabled={isLoading}>
                  <TrashIcon className="w-4 h-4" />
                  Clear All
                </button>
              }
          </div>
          <div className="bg-light p-3 rounded-lg min-h-[150px] max-h-72 overflow-y-auto">
            {isLoading && stops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-content-200 py-10">
                <Spinner />
                <span className="mt-3 font-medium">Extracting addresses...</span>
              </div>
            ) : stops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-content-200 py-10">
                   <p className="font-medium">Your stops will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {stops.map((stop, index) => (
                  <li key={stop.id} className="flex items-center justify-between bg-white border border-medium p-3 rounded-md animate-fade-in-sm">
                    <span className="text-content-100 truncate pr-2">
                      <span className="font-bold text-brand-text mr-3">{index + 1}.</span> 
                      {stop.address}
                    </span>
                    <button onClick={() => removeStop(stop.id)} className="text-dark hover:text-red-500 p-1 rounded-full transition disabled:opacity-50" disabled={isLoading}>
                      <RemoveIcon className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {stops.length >= 2 && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={proceedToReview}
              className="w-full sm:w-auto bg-gradient-primary text-brand-text font-bold py-3 px-8 rounded-lg flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
              disabled={isLoading}
            >
              Review Route
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default AddressInputScreen;