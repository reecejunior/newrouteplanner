import React, { useState, useEffect } from 'react';
import { LogoIcon } from './Icons';

const phrases = [
  "Optimize your multi-stop journeys with intelligent routing.",
  "Upload an image to instantly extract addresses.",
  "Enter stops manually to build your perfect trip.",
  "Save and load your routes for ultimate convenience."
];

const Banner: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isInitialRender, setIsInitialRender] = useState(true);

  useEffect(() => {
    const intervalId = setInterval(() => {
      // After the first automatic change, it's no longer the initial render cycle.
      if (isInitialRender) {
        setIsInitialRender(false);
      }
      setPhraseIndex(current => (current + 1) % phrases.length);
    }, 4000); // Change phrase every 4 seconds

    return () => clearInterval(intervalId);
  }, [isInitialRender]);

  return (
    <div 
      className="bg-gradient-dark rounded-2xl p-8 mb-8 overflow-hidden relative animate-fade-in"
    >
      {/* Decorative background elements */}
      <LogoIcon className="absolute -right-16 -bottom-16 w-64 h-64 text-brand-primary/5 opacity-50 rotate-12" />
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-brand-primary/10 rounded-full animate-pulse-slow"></div>
      <div 
        className="absolute -bottom-16 -left-16 w-64 h-64 bg-brand-secondary/10 rounded-full animate-pulse-slow"
        style={{ animationDelay: '1s' }}
      ></div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-shrink-0">
          <LogoIcon 
            className="w-28 h-28 text-brand-primary opacity-0 animate-fade-in animate-glow" 
            style={{ animationDelay: '0.2s' }}
          />
        </div>
        <div>
          <h2 
            className="text-3xl font-bold font-heading text-white mb-2 opacity-0 animate-slide-in-up"
            style={{ animationDelay: '0.4s' }}
          >
            Welcome to the AI Route Planner
          </h2>
          <div className="h-14 md:h-auto"> {/* Container to prevent layout shift */}
            <p 
              key={phraseIndex}
              className="text-slate-300 text-lg opacity-0 animate-text-swoop-in"
              style={{ animationDelay: isInitialRender ? '0.6s' : '0.1s' }}
            >
              {phrases[phraseIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Banner;