import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';

interface ClickableAlbumCoverProps {
  coverArtUrl: string;
  previewUrl?: string;
  songTitle: string;
  songArtist: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
}

const ClickableAlbumCover: React.FC<ClickableAlbumCoverProps> = ({
  coverArtUrl,
  previewUrl,
  songTitle,
  songArtist,
  size = 'medium',
  className = '',
  onPlay,
  onPause,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Size configurations
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-20 h-20',
    large: 'w-24 h-24',
  };

  const iconSizes = {
    small: 12,
    medium: 16,
    large: 20,
  };

  // Initialize audio element
  useEffect(() => {
    if (!previewUrl) return;

    const audioElement = new Audio(previewUrl);
    audioElement.volume = 0.7;
    
    audioElement.addEventListener('ended', () => {
      setIsPlaying(false);
      if (onPause) onPause();
    });

    audioElement.addEventListener('error', () => {
      console.log('Error loading audio preview');
      setIsPlaying(false);
    });
    
    setAudio(audioElement);
    audioRef.current = audioElement;
    
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.remove();
      }
    };
  }, [previewUrl, onPause]);

  // Global audio management - pause other audio when this one starts
  useEffect(() => {
    if (isPlaying && audio) {
      // Pause all other audio elements
      const allAudioElements = document.querySelectorAll('audio');
      allAudioElements.forEach((audioEl) => {
        if (audioEl !== audio) {
          audioEl.pause();
        }
      });
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('audioStarted', { 
        detail: { source: 'clickable-album-cover', audio } 
      }));
    }
  }, [isPlaying, audio]);

  // Listen for other audio starting
  useEffect(() => {
    const handleOtherAudioStarted = (event: any) => {
      if (event.detail.audio !== audio && audio) {
        audio.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener('audioStarted', handleOtherAudioStarted);
    
    return () => {
      window.removeEventListener('audioStarted', handleOtherAudioStarted);
    };
  }, [audio]);

  const handleClick = (e: React.MouseEvent) => {
    if (!previewUrl || !audio) {
      console.log('No preview URL available for', songTitle);
      // Don't stop propagation when there's no preview - allow parent click handlers to work
      return;
    }

    // Don't stop propagation by default - let the post selection work
    // Only stop propagation if we're actually playing/pausing audio
  };

  const handlePlayButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling for play button
    
    if (!previewUrl || !audio) {
      return;
    }
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (onPause) onPause();
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        if (onPlay) onPlay();
      }).catch((error) => {
        console.error('Error playing audio:', error);
      });
    }
  };

  return (
    <div 
      className={`relative group cursor-pointer ${sizeClasses[size]} ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={previewUrl ? `Click to play "${songTitle}" by ${songArtist}` : `"${songTitle}" by ${songArtist} - No preview available`}
    >
      {/* Album Cover Image */}
      <img
        src={coverArtUrl || '/images/default-album.svg'}
        alt={`${songTitle} by ${songArtist}`}
        className="w-full h-full object-cover rounded-lg"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/images/default-album.svg';
        }}
      />
      
      {/* Play/Pause Overlay */}
      {previewUrl && (
        <div 
          className={`absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center transition-opacity duration-200 ${
            isHovered || isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div 
            className="bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 transition-all duration-200 transform hover:scale-110"
            onClick={handlePlayButtonClick}
          >
            {isPlaying ? (
              <FaPause 
                className="text-gray-800" 
                size={iconSizes[size]} 
              />
            ) : (
              <FaPlay 
                className="text-gray-800 ml-0.5" 
                size={iconSizes[size]} 
              />
            )}
          </div>
        </div>
      )}
      
      {/* No Preview Indicator */}
      {!previewUrl && isHovered && (
        <div className="absolute inset-0 bg-black bg-opacity-60 rounded-lg flex items-center justify-center">
          <div className="text-white text-xs text-center px-2">
            No Preview
          </div>
        </div>
      )}
    </div>
  );
};

export default ClickableAlbumCover; 