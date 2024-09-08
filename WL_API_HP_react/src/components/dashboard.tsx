import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, AlertTriangle, AccessibilityIcon, Timer, AlertCircle, History } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAX_RECENT_SEARCHES = 5;

const App = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedStation, setSelectedStation] = useState({ name: '', title: '' });
  const [departureData, setDepartureData] = useState([]);
  const [error, setError] = useState('');
  const [expandedLines, setExpandedLines] = useState({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load recent searches from localStorage on component mount
    const savedSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    setRecentSearches(savedSearches);
  }, []);

  const saveRecentSearch = (search) => {
    const updatedSearches = [search, ...recentSearches.filter(s => s.name !== search.name)]
      .slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  const fetchData = useCallback(async () => {
    if (!selectedStation.name) return;

    try {
      const response = await fetch(`https://nodejs-serverless-function-express-iota-kohl.vercel.app/api/proxy?url=/ws/monitor?diva=${selectedStation.name}&_=${Date.now()}`);
      const data = await response.json();

      if (data.message.messageCode !== 1) {
        throw new Error('Error fetching data: ' + data.message.value);
      }

      setDepartureData(data.data.monitors);
      setError('');
    } catch (e) {
      console.error('Error fetching data:', e);
      setError('Fehler beim Abrufen der Daten.');
    }
  }, [selectedStation.name]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchSuggestions = useCallback(async (value) => {
    if (!value) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`https://nodejs-serverless-function-express-iota-kohl.vercel.app/api/proxy?url=/ws/location?search=${encodeURIComponent(value)}&type=stop`);
      const data = await response.json();

      if (data.message.messageCode !== 1) {
        throw new Error('Error searching station: ' + data.message.value);
      }

      setSuggestions(data.data.pois.map(poi => ({
        name: poi.location.properties.name,
        title: poi.location.properties.title
      })));
      setShowSuggestions(true);
    } catch (e) {
      console.error('Error fetching suggestions:', e);
      setError('Fehler beim Abrufen der Vorschläge.');
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchSuggestions]);

  const handleStationSelect = (station) => {
    setSelectedStation(station);
    setSearchTerm(station.title);
    setShowSuggestions(false);
    setShowRecentSearches(false);
    saveRecentSearch(station);
    if (inputRef.current) {
      inputRef.current.blur(); // This will deselect the input field
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setShowRecentSearches(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleLineExpansion = (lineName) => {
    setExpandedLines(prev => ({ ...prev, [lineName]: !prev[lineName] }));
  };

  const groupDeparturesByLine = (monitors) => {
    const grouped = {};
    monitors.forEach(monitor => {
      monitor.lines.forEach(line => {
        if (!grouped[line.name]) {
          grouped[line.name] = {
            ...line,
            departures: []
          };
        }
        grouped[line.name].departures.push(...line.departures.departure);
      });
    });

    // Sort departures for each line
    Object.values(grouped).forEach(line => {
      line.departures.sort((a, b) => a.departureTime.countdown - b.departureTime.countdown);
    });

    return grouped;
  };

  const renderDepartures = (groupedDepartures) => {
    return Object.entries(groupedDepartures).map(([lineName, lineData]) => (
      <React.Fragment key={lineName}>
        <TableRow className="cursor-pointer" onClick={() => toggleLineExpansion(lineName)}>
          <TableCell className="font-medium">{lineName}</TableCell>
          <TableCell>{lineData.towards}</TableCell>
          <TableCell className="text-right">
            {lineData.departures[0]?.departureTime.countdown} min
            {lineData.barrierFree && <AccessibilityIcon className="inline ml-2" size={16} />}
            {!lineData.realtimeSupported && <Timer className="inline ml-2" size={16} />}
            {lineData.trafficjam && <AlertCircle className="inline ml-2" size={16} />}
          </TableCell>
        </TableRow>
        <AnimatePresence>
          {expandedLines[lineName] && lineData.departures.slice(1).map((dep, index) => (
            <motion.tr
              key={`${lineName}-${index}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <TableCell></TableCell>
              <TableCell>{dep.vehicle?.towards || lineData.towards}</TableCell>
              <TableCell className="text-right">{dep.departureTime.countdown} min</TableCell>
            </motion.tr>
          ))}
        </AnimatePresence>
      </React.Fragment>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <motion.h1
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold text-center mb-8"
      >
        Wiener Linien Abfahrtsmonitor
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6"
      >
        <div className="mb-6 relative" ref={searchRef}>
          <div className="flex">
            <Input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowRecentSearches(true)}
              placeholder="Haltestelle suchen"
              className="flex-grow mr-2"
            />
            <Button onClick={() => handleStationSelect(suggestions[0])}>
              <Search className="mr-2" />
              Suchen
            </Button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 rounded-md shadow-lg">
              {suggestions.map((station, index) => (
                <li
                  key={station.name}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleStationSelect(station)}
                >
                  {station.title}
                </li>
              ))}
            </ul>
          )}
          {showRecentSearches && recentSearches.length > 0 && !showSuggestions && (
            <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 rounded-md shadow-lg">
              {recentSearches.map((station, index) => (
                <li
                  key={station.name}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                  onClick={() => handleStationSelect(station)}
                >
                  <History className="mr-2" size={16} />
                  {station.title}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">{selectedStation.title || 'Keine Station ausgewählt'}</h2>
          <div className="flex items-center">
            <Clock className="mr-2" />
            <span className="text-lg">
              {currentTime.toLocaleTimeString()} | {currentTime.toLocaleDateString()}
            </span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence>
          {departureData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linie</TableHead>
                    <TableHead>Richtung</TableHead>
                    <TableHead className="text-right">Abfahrt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderDepartures(groupDeparturesByLine(departureData))}
                </TableBody>
              </Table>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default App;