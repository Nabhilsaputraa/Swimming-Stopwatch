import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Plus, Trash2, Clock, Settings, RotateCcw, Flag, Edit3, Check, FileText, Users, Timer, Medal, Download, Upload, Target, Zap, Activity } from 'lucide-react';

export default function ProfessionalSwimmingTimer() {
  const [athletes, setAthletes] = useState([]);
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groups, setGroups] = useState([
    { id: 1, name: 'Lane 1-4', color: 'bg-blue-600', athletes: [] }
  ]);
  const [sessions, setSessions] = useState([
    { 
      id: 1, 
      name: '', 
      distance: 50,
      stroke: 'freestyle',
      sets: 1,
      currentSet: 1,
      isActive: true,
      restDuration: 60,
      restMode: 'individual',
      restAutoStart: false,
      targetTime: null
    }
  ]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [records, setRecords] = useState([]);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [activeView, setActiveView] = useState('timer');
  const [editingSession, setEditingSession] = useState(null);
  
  // Advanced timing features
  const [quickFinishMode, setQuickFinishMode] = useState(false);
  const [finishQueue, setFinishQueue] = useState([]);
  const [nextRank, setNextRank] = useState(1);
  const [splitTimes, setSplitTimes] = useState({});
  const [restTimers, setRestTimers] = useState({});
  const [isRestPhase, setIsRestPhase] = useState(false);
  
  // Sound and notifications
  const audioContextRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Timer effects with precise timing
  useEffect(() => {
    const interval = setInterval(() => {
      // Update athlete timers
      setAthletes(prevAthletes => 
        prevAthletes.map(athlete => 
          athlete.isRunning 
            ? { ...athlete, time: athlete.time + 1 }
            : athlete
        )
      );

      // Update rest timers
      if (isRestPhase) {
        setRestTimers(prevTimers => {
          const newTimers = { ...prevTimers };
          let anyTimerRunning = false;
          
          Object.keys(newTimers).forEach(key => {
            if (newTimers[key] > 0) {
              newTimers[key] = Math.max(0, newTimers[key] - 0.01);
              anyTimerRunning = newTimers[key] > 0;
            } else if (newTimers[key] === 0) {
              if (getCurrentSession().restMode === 'individual') {
                handleRestFinished(key);
              }
              newTimers[key] = -1;
            }
          });

          if (getCurrentSession().restMode === 'group' && !anyTimerRunning && Object.keys(newTimers).length > 0) {
            handleAllRestFinished();
          }

          return newTimers;
        });
      }
    }, 10);

    return () => clearInterval(interval);
  }, [isRestPhase]);

  // Sound functions
  const playSound = (frequency = 800, duration = 200) => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);
    
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  };

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const formatTime = (centiseconds) => {
    const minutes = Math.floor(centiseconds / 6000);
    const seconds = Math.floor((centiseconds % 6000) / 100);
    const cs = centiseconds % 100;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const formatRestTime = (seconds) => {
    const mins = Math.floor(seconds);
    const secs = Math.floor((seconds - mins) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentSession = () => sessions[currentSessionIndex] || sessions[0];

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const colors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-red-600', 'bg-yellow-600', 'bg-indigo-600', 'bg-pink-600', 'bg-cyan-600'];
    const newGroup = {
      id: Date.now(),
      name: newGroupName.trim(),
      color: colors[groups.length % colors.length],
      athletes: []
    };
    setGroups([...groups, newGroup]);
    setNewGroupName('');
  };

  const removeGroup = (groupId) => {
    if (groups.length <= 1) {
      alert('At least one group must exist!');
      return;
    }
    const groupToDelete = groups.find(g => g.id === groupId);
    if (groupToDelete && groupToDelete.athletes.length > 0) {
      const firstGroup = groups.find(g => g.id !== groupId);
      setGroups(groups.map(g => 
        g.id === firstGroup.id 
          ? { ...g, athletes: [...g.athletes, ...groupToDelete.athletes] }
          : g
      ).filter(g => g.id !== groupId));
      
      setAthletes(athletes.map(athlete => 
        groupToDelete.athletes.includes(athlete.id)
          ? { ...athlete, groupId: firstGroup.id }
          : athlete
      ));
    } else {
      setGroups(groups.filter(g => g.id !== groupId));
    }
  };

  const addAthlete = () => {
    if (!newAthleteName.trim()) return;
    const firstGroup = groups[0];
    const newAthlete = {
      id: Date.now(),
      name: newAthleteName.trim(),
      time: 0,
      isRunning: false,
      isFinished: false,
      lane: athletes.length + 1,
      groupId: firstGroup.id,
      isResting: false,
      splits: [],
      bestTime: null
    };
    setAthletes([...athletes, newAthlete]);
    setGroups(groups.map(g => 
      g.id === firstGroup.id 
        ? { ...g, athletes: [...g.athletes, newAthlete.id] }
        : g
    ));
    setNewAthleteName('');
  };

  const removeAthlete = (id) => {
    setGroups(groups.map(g => ({
      ...g,
      athletes: g.athletes.filter(athleteId => athleteId !== id)
    })));
    setAthletes(athletes.filter(athlete => athlete.id !== id).map((athlete, index) => ({
      ...athlete,
      lane: index + 1
    })));
  };

  const moveAthleteToGroup = (athleteId, targetGroupId) => {
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete) return;

    setGroups(groups.map(g => ({
      ...g,
      athletes: g.id === targetGroupId 
        ? [...g.athletes.filter(id => id !== athleteId), athleteId]
        : g.athletes.filter(id => id !== athleteId)
    })));

    setAthletes(athletes.map(a => 
      a.id === athleteId ? { ...a, groupId: targetGroupId } : a
    ));
  };

  const addSession = () => {
    const newSession = {
      id: Date.now(),
      name: '',
      distance: 50,
      stroke: 'freestyle',
      sets: 1,
      currentSet: 1,
      isActive: true,
      restDuration: 60,
      restMode: 'individual',
      restAutoStart: false,
      targetTime: null
    };
    setSessions([...sessions, newSession]);
    setEditingSession(newSession.id);
  };

  const removeSession = (id) => {
    if (sessions.length <= 1) return;
    setSessions(sessions.filter(s => s.id !== id));
    if (currentSessionIndex >= sessions.length - 1) {
      setCurrentSessionIndex(Math.max(0, sessions.length - 2));
    }
  };

  const updateSession = (id, field, value) => {
    setSessions(sessions.map(s => 
      s.id === id 
        ? { ...s, [field]: ['distance', 'sets', 'restDuration'].includes(field) ? Math.max(1, parseInt(value) || 1) : value }
        : s
    ));
  };

  const toggleAthlete = (id) => {
    const currentSession = getCurrentSession();
    if (!currentSession.name.trim()) {
      alert('Please enter session name first!');
      return;
    }
    
    if (isRestPhase) {
      alert('Rest phase is active. Wait for rest to finish.');
      return;
    }
    
    setAthletes(athletes.map(athlete => {
      if (athlete.id === id) {
        if (athlete.isRunning) {
          return { ...athlete, isRunning: false };
        } else if (athlete.isFinished) {
          return { ...athlete, isRunning: true, isFinished: false, time: 0, isResting: false, splits: [] };
        } else {
          return { ...athlete, isRunning: true, isFinished: false };
        }
      }
      return athlete;
    }));
  };

  const recordSplit = (athleteId, splitDistance) => {
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete || !athlete.isRunning) return;

    const newSplit = {
      distance: splitDistance,
      time: athlete.time,
      formattedTime: formatTime(athlete.time)
    };

    setAthletes(athletes.map(a => 
      a.id === athleteId 
        ? { ...a, splits: [...a.splits, newSplit] }
        : a
    ));

    setSplitTimes(prev => ({
      ...prev,
      [`${athleteId}-${splitDistance}`]: athlete.time
    }));

    playSound(1000, 150);
  };

  const addToFinishQueue = (athleteId) => {
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete || athlete.isFinished || finishQueue.find(f => f.athleteId === athleteId)) return;

    const newFinish = {
      athleteId,
      rank: nextRank,
      time: athlete.time,
      splits: [...athlete.splits],
      timestamp: Date.now()
    };

    setFinishQueue([...finishQueue, newFinish]);
    setNextRank(nextRank + 1);
    playSound(1200, 300);
  };

  const removeFromFinishQueue = (athleteId) => {
    const newQueue = finishQueue.filter(f => f.athleteId !== athleteId);
    setFinishQueue(newQueue);
    
    const reorderedQueue = newQueue.map((finish, index) => ({
      ...finish,
      rank: index + 1
    }));
    setFinishQueue(reorderedQueue);
    setNextRank(reorderedQueue.length + 1);
  };

  const confirmFinishes = () => {
    const currentSession = getCurrentSession();
    
    finishQueue.forEach(finish => {
      const athlete = athletes.find(a => a.id === finish.athleteId);
      const group = groups.find(g => g.id === athlete.groupId);
      
      const newRecord = {
        id: Date.now() + Math.random() + finish.rank,
        athleteName: athlete.name,
        lane: athlete.lane,
        groupName: group ? group.name : 'Unknown',
        sessionName: currentSession.name,
        distance: currentSession.distance,
        stroke: currentSession.stroke,
        setNumber: currentSession.currentSet,
        time: formatTime(finish.time),
        rawTime: finish.time,
        rank: finish.rank,
        splits: finish.splits,
        targetTime: currentSession.targetTime,
        timestamp: new Date().toLocaleString('en-ID'),
        sessionIndex: currentSessionIndex + 1
      };
      
      setRecords(prev => [newRecord, ...prev]);

      // Update athlete best time
      setAthletes(prevAthletes => 
        prevAthletes.map(a => 
          a.id === finish.athleteId 
            ? { ...a, bestTime: !a.bestTime || finish.time < a.bestTime ? finish.time : a.bestTime }
            : a
        )
      );
    });

    const finishedIds = finishQueue.map(f => f.athleteId);
    setAthletes(athletes.map(a => 
      finishedIds.includes(a.id)
        ? { ...a, isRunning: false, isFinished: true }
        : a
    ));

    if (currentSession.restDuration > 0) {
      checkAndStartRest(finishedIds);
    }

    setFinishQueue([]);
    setNextRank(1);
    setQuickFinishMode(false);
    playSound(800, 500);
  };

  const finishAthlete = (id) => {
    const athlete = athletes.find(a => a.id === id);
    const currentSession = getCurrentSession();
    
    if (athlete && (athlete.isRunning || athlete.time > 0)) {
      const group = groups.find(g => g.id === athlete.groupId);
      const newRecord = {
        id: Date.now() + Math.random(),
        athleteName: athlete.name,
        lane: athlete.lane,
        groupName: group ? group.name : 'Unknown',
        sessionName: currentSession.name,
        distance: currentSession.distance,
        stroke: currentSession.stroke,
        setNumber: currentSession.currentSet,
        time: formatTime(athlete.time),
        rawTime: athlete.time,
        splits: [...athlete.splits],
        targetTime: currentSession.targetTime,
        timestamp: new Date().toLocaleString('en-ID'),
        sessionIndex: currentSessionIndex + 1
      };
      
      setRecords([newRecord, ...records]);
      
      setAthletes(athletes.map(a => 
        a.id === id 
          ? { 
              ...a, 
              isRunning: false, 
              isFinished: true,
              bestTime: !a.bestTime || athlete.time < a.bestTime ? athlete.time : a.bestTime
            }
          : a
      ));

      if (currentSession.restDuration > 0) {
        checkAndStartRest([id]);
      }

      playSound(1000, 400);
    }
  };

  const checkAndStartRest = (finishedAthleteIds) => {
    const currentSession = getCurrentSession();
    
    if (currentSession.restMode === 'individual') {
      finishedAthleteIds.forEach(id => startRestForAthlete(id));
    } else if (currentSession.restMode === 'group') {
      const finishedAthlete = athletes.find(a => finishedAthleteIds.includes(a.id));
      const group = groups.find(g => g.id === finishedAthlete.groupId);
      const groupAthletes = athletes.filter(a => a.groupId === group.id);
      const allFinished = groupAthletes.every(a => a.isFinished || finishedAthleteIds.includes(a.id));
      
      if (allFinished) {
        startRestForGroup(group.id);
      }
    }
  };

  const startRestForAthlete = (athleteId) => {
    const currentSession = getCurrentSession();
    setRestTimers(prev => ({ ...prev, [athleteId]: currentSession.restDuration }));
    setAthletes(athletes.map(a => 
      a.id === athleteId ? { ...a, isResting: true } : a
    ));
    setIsRestPhase(true);
  };

  const startRestForGroup = (groupId) => {
    const currentSession = getCurrentSession();
    setRestTimers(prev => ({ ...prev, [groupId]: currentSession.restDuration }));
    const groupAthletes = athletes.filter(a => a.groupId === groupId);
    setAthletes(athletes.map(a => 
      groupAthletes.some(ga => ga.id === a.id) ? { ...a, isResting: true } : a
    ));
    setIsRestPhase(true);
  };

  const handleRestFinished = (athleteId) => {
    const currentSession = getCurrentSession();
    if (currentSession.restAutoStart) {
      setAthletes(athletes.map(a => 
        a.id === parseInt(athleteId) 
          ? { ...a, isRunning: true, isFinished: false, time: 0, isResting: false, splits: [] }
          : a
      ));
    } else {
      setAthletes(athletes.map(a => 
        a.id === parseInt(athleteId) 
          ? { ...a, isResting: false }
          : a
      ));
    }
  };

  const handleAllRestFinished = () => {
    const currentSession = getCurrentSession();
    if (currentSession.restAutoStart) {
      nextSet();
    }
    setIsRestPhase(false);
    setRestTimers({});
    setAthletes(athletes.map(a => ({ ...a, isResting: false })));
  };

  const startAll = () => {
    const currentSession = getCurrentSession();
    if (!currentSession.name.trim()) {
      alert('Please enter session name first!');
      return;
    }
    
    if (isRestPhase) {
      alert('Rest phase is active. Wait for rest to finish.');
      return;
    }
    
    setAthletes(athletes.map(athlete => ({ 
      ...athlete, 
      isRunning: true, 
      isFinished: false,
      time: 0,
      isResting: false,
      splits: []
    })));
    setFinishQueue([]);
    setNextRank(1);
    playSound(1500, 200);
  };

  const resetAll = () => {
    setAthletes(athletes.map(athlete => ({ 
      ...athlete, 
      time: 0, 
      isRunning: false, 
      isFinished: false,
      isResting: false,
      splits: []
    })));
    setRestTimers({});
    setIsRestPhase(false);
    setFinishQueue([]);
    setNextRank(1);
    setQuickFinishMode(false);
    setSplitTimes({});
  };

  const nextSet = () => {
    const currentSession = getCurrentSession();
    
    if (currentSession.currentSet < currentSession.sets) {
      setSessions(sessions.map(s => 
        s.id === currentSession.id 
          ? { ...s, currentSet: s.currentSet + 1 }
          : s
      ));
      resetAll();
    } else {
      if (currentSessionIndex < sessions.length - 1) {
        setCurrentSessionIndex(currentSessionIndex + 1);
        setSessions(sessions.map(s => ({ ...s, currentSet: 1 })));
        resetAll();
      } else {
        if (window.confirm('All sessions completed! Reset to Session 1?')) {
          setCurrentSessionIndex(0);
          setSessions(sessions.map(s => ({ ...s, currentSet: 1 })));
          resetAll();
        }
      }
    }
  };

  const deleteRecord = (id) => {
    setRecords(records.filter(record => record.id !== id));
  };

  const clearAllRecords = () => {
    if (window.confirm('Are you sure you want to delete all records?')) {
      setRecords([]);
    }
  };

  const exportData = () => {
    const exportData = {
      athletes,
      groups,
      sessions,
      records,
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `swimming_timer_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.athletes) setAthletes(data.athletes);
        if (data.groups) setGroups(data.groups);
        if (data.sessions) setSessions(data.sessions);
        if (data.records) setRecords(data.records);
        alert('Data imported successfully!');
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const goToTimer = () => {
    if (athletes.length === 0) {
      alert('Add at least one athlete!');
      return;
    }
    
    const hasEmptySession = sessions.some(s => !s.name.trim());
    if (hasEmptySession) {
      alert('Please fill in all session names!');
      return;
    }
    
    setIsSetupMode(false);
  };

  const getGroupedRecords = () => {
    const grouped = {};
    records.forEach(record => {
      const key = `${record.sessionName}-Set${record.setNumber}`;
      if (!grouped[key]) {
        grouped[key] = {
          sessionName: record.sessionName,
          distance: record.distance,
          stroke: record.stroke,
          setNumber: record.setNumber,
          sessionIndex: record.sessionIndex,
          records: []
        };
      }
      grouped[key].records.push(record);
    });
    
    Object.values(grouped).forEach(group => {
      group.records.sort((a, b) => {
        if (a.rank && b.rank) return a.rank - b.rank;
        return a.rawTime - b.rawTime;
      });
    });
    
    return Object.values(grouped).sort((a, b) => {
      if (a.sessionIndex !== b.sessionIndex) {
        return a.sessionIndex - b.sessionIndex;
      }
      return a.setNumber - b.setNumber;
    });
  };

  const getTargetComparison = (time, targetTime) => {
    if (!targetTime) return null;
    const diff = time - targetTime;
    const diffFormatted = formatTime(Math.abs(diff));
    return {
      faster: diff < 0,
      difference: diffFormatted,
      percentage: ((Math.abs(diff) / targetTime) * 100).toFixed(1)
    };
  };

  if (isSetupMode) {
    return (
      <div className="min-h-screen bg-gray-900" style={{ 
        background: `
          radial-gradient(600px circle at 20% 30%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
          radial-gradient(400px circle at 80% 70%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)
        `
      }}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Professional Swimming Timer</h1>
            <p className="text-gray-400 text-lg">Advanced timing system for competitive swimming</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Sessions Setup */}
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="text-blue-400" size={24} />
                  Training Sessions
                </h2>
                <button
                  onClick={addSession}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-all duration-300 hover:scale-105"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {sessions.map((session, index) => (
                  <div key={session.id} className="border border-gray-700 rounded-xl p-4 bg-gray-800 bg-opacity-40 hover:bg-opacity-60 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-200">Session {index + 1}</span>
                    </div>

                    {editingSession === session.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={session.name}
                          onChange={(e) => updateSession(session.id, 'name', e.target.value)}
                          placeholder="Session name (e.g., 50m Freestyle Sprint)"
                          className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={session.distance}
                            onChange={(e) => updateSession(session.id, 'distance', e.target.value)}
                            placeholder="Distance (m)"
                            min="25"
                            className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <select
                            value={session.stroke}
                            onChange={(e) => updateSession(session.id, 'stroke', e.target.value)}
                            className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="freestyle">Freestyle</option>
                            <option value="backstroke">Backstroke</option>
                            <option value="breaststroke">Breaststroke</option>
                            <option value="butterfly">Butterfly</option>
                            <option value="medley">Individual Medley</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={session.sets}
                            onChange={(e) => updateSession(session.id, 'sets', e.target.value)}
                            placeholder="Total sets"
                            min="1"
                            className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={session.targetTime || ''}
                            onChange={(e) => {
                              const timeStr = e.target.value;
                              if (!timeStr) {
                                updateSession(session.id, 'targetTime', null);
                                return;
                              }
                              // Parse MM:SS.CC format to centiseconds
                              const parts = timeStr.split(':');
                              if (parts.length === 2) {
                                const [minutes, secondsAndCs] = parts;
                                const [seconds, cs] = secondsAndCs.split('.');
                                const totalCs = (parseInt(minutes) || 0) * 6000 + (parseInt(seconds) || 0) * 100 + (parseInt(cs) || 0);
                                updateSession(session.id, 'targetTime', totalCs);
                              }
                            }}
                            placeholder="Target time (MM:SS.CC)"
                            className="px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div className="pt-3 border-t border-gray-600">
                          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                            <Timer size={16} />
                            Rest Configuration
                          </h4>
                          
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={session.restDuration}
                              onChange={(e) => updateSession(session.id, 'restDuration', e.target.value)}
                              placeholder="Rest duration (seconds)"
                              min="0"
                              className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />

                            <select
                              value={session.restMode}
                              onChange={(e) => updateSession(session.id, 'restMode', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="individual">Individual Rest</option>
                              <option value="group">Group Rest</option>
                            </select>

                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={session.restAutoStart}
                                onChange={(e) => updateSession(session.id, 'restAutoStart', e.target.checked)}
                                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-400">Auto start after rest</span>
                            </label>
                          </div>
                        </div>

                        <button
                          onClick={() => setEditingSession(null)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                          <Check size={16} className="inline mr-2" />
                          Save Session
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-white">
                            {session.name || 'Untitled Session'}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {session.distance}m {session.stroke} • {session.sets} sets
                            {session.targetTime && (
                              <span className="text-blue-400 ml-2">
                                Target: {formatTime(session.targetTime)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Rest: {session.restDuration}s ({session.restMode})
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => setEditingSession(session.id)}
                            className="text-gray-400 hover:text-blue-400 p-2 transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          {sessions.length > 1 && (
                            <button
                              onClick={() => removeSession(session.id)}
                              className="text-gray-400 hover:text-red-400 p-2 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Groups Setup */}
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Users className="text-green-400" size={24} />
                  Lane Groups
                </h2>
                <button
                  onClick={addGroup}
                  className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-all duration-300 hover:scale-105"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addGroup()}
                  className="flex-1 px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Group name (e.g., Lane 5-8)"
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {groups.map((group) => {
                  const groupAthletes = athletes.filter(a => a.groupId === group.id);
                  return (
                    <div key={group.id} className="border border-gray-700 rounded-xl p-4 bg-gray-800 bg-opacity-40 hover:bg-opacity-60 transition-all duration-300">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 ${group.color} rounded-full shadow-lg`}></div>
                          <span className="font-medium text-white">{group.name}</span>
                          <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            {groupAthletes.length} swimmers
                          </span>
                        </div>
                        {groups.length > 1 && (
                          <button
                            onClick={() => removeGroup(group.id)}
                            className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {groupAthletes.length > 0 && (
                        <div className="text-sm text-gray-400 bg-gray-700 bg-opacity-50 rounded p-2">
                          {groupAthletes.map(a => a.name).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Athletes Setup */}
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Target className="text-purple-400" size={24} />
                  Swimmers
                </h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-400">Sound</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newAthleteName}
                  onChange={(e) => setNewAthleteName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAthlete()}
                  className="flex-1 px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Swimmer name"
                />
                <button
                  onClick={addAthlete}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Add Swimmer
                </button>
              </div>

              {athletes.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {athletes.map((athlete) => {
                    const athleteGroup = groups.find(g => g.id === athlete.groupId);
                    return (
                      <div key={athlete.id} className="border border-gray-700 rounded-xl p-4 bg-gray-800 bg-opacity-40 hover:bg-opacity-60 transition-all duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg flex items-center justify-center font-bold">
                              {athlete.lane}
                            </div>
                            <div>
                              <div className="font-medium text-white">{athlete.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={`w-3 h-3 ${athleteGroup?.color} rounded-full`}></div>
                                <span className="text-sm text-gray-400">{athleteGroup?.name}</span>
                                {athlete.bestTime && (
                                  <span className="text-xs text-green-400 bg-green-900 px-2 py-1 rounded">
                                    PB: {formatTime(athlete.bestTime)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeAthlete(athlete.id)}
                            className="text-gray-400 hover:text-red-400 p-2 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <select
                          value={athlete.groupId}
                          onChange={(e) => moveAthleteToGroup(athlete.id, parseInt(e.target.value))}
                          className="w-full text-sm border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                        >
                          {groups.map(group => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={goToTimer}
                  disabled={athletes.length === 0 || sessions.some(s => !s.name.trim())}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                >
                  <Play size={20} className="inline mr-2" />
                  Start Timer ({athletes.length} swimmers)
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={exportData}
                    className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-colors"
                    title="Export Data"
                  >
                    <Download size={20} />
                  </button>
                  
                  <label className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-colors cursor-pointer" title="Import Data">
                    <Upload size={20} />
                    <input
                      type="file"
                      accept=".json"
                      onChange={importData}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSession = getCurrentSession();

  return (
    <div className="min-h-screen bg-gray-900" style={{ 
      background: `
        radial-gradient(600px circle at 20% 30%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
        radial-gradient(400px circle at 80% 70%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)
      `
    }}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 p-6 mb-6 shadow-xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {currentSession.name || `Session ${currentSessionIndex + 1}`}
              </h1>
              <div className="flex items-center gap-6 text-gray-400">
                <span className="flex items-center gap-2">
                  <Target size={16} />
                  {currentSession.distance}m {currentSession.stroke}
                </span>
                <span className="flex items-center gap-2">
                  <Flag size={16} />
                  Set {currentSession.currentSet} of {currentSession.sets}
                </span>
                <span className="flex items-center gap-2">
                  <Users size={16} />
                  {athletes.length} swimmers
                </span>
                {currentSession.restDuration > 0 && (
                  <span className="flex items-center gap-2 text-orange-400">
                    <Timer size={16} />
                    Rest: {formatRestTime(currentSession.restDuration)}s ({currentSession.restMode})
                  </span>
                )}
                {currentSession.targetTime && (
                  <span className="flex items-center gap-2 text-blue-400">
                    <Clock size={16} />
                    Target: {formatTime(currentSession.targetTime)}
                  </span>
                )}
                {isRestPhase && (
                  <span className="text-orange-400 font-semibold animate-pulse">
                    Rest Phase Active
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveView(activeView === 'timer' ? 'records' : 'timer')}
                className="flex items-center gap-2 bg-gray-700 bg-opacity-60 hover:bg-opacity-80 text-white px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105"
              >
                {activeView === 'timer' ? <FileText size={18} /> : <Clock size={18} />}
                {activeView === 'timer' ? 'View Results' : 'Timer'}
              </button>
              <button
                onClick={() => setIsSetupMode(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105"
              >
                <Settings size={18} />
                Setup
              </button>
            </div>
          </div>
        </div>

        {activeView === 'timer' ? (
          <>
            {/* Global Controls */}
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 p-6 mb-6 shadow-xl">
              <div className="flex justify-center gap-4 flex-wrap">
                <button
                  onClick={startAll}
                  disabled={isRestPhase}
                  className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  <Play size={24} />
                  START ALL
                </button>
                <button
                  onClick={resetAll}
                  className="flex items-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  <RotateCcw size={24} />
                  RESET ALL
                </button>
                <button
                  onClick={() => setQuickFinishMode(!quickFinishMode)}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg ${
                    quickFinishMode 
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white' 
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'
                  }`}
                >
                  <Flag size={24} />
                  {quickFinishMode ? 'EXIT QUICK FINISH' : 'QUICK FINISH'}
                </button>
                <button
                  onClick={nextSet}
                  disabled={isRestPhase}
                  className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  {currentSession.currentSet < currentSession.sets ? 'NEXT SET' : 
                   currentSessionIndex < sessions.length - 1 ? 'NEXT SESSION' : 'COMPLETE'}
                </button>
              </div>
            </div>

            {/* Quick Finish Panel */}
            {quickFinishMode && (
              <div className="bg-gradient-to-r from-purple-900 to-purple-800 border border-purple-600 rounded-2xl p-6 mb-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Flag className="text-purple-300" />
                    Quick Finish Mode
                  </h3>
                  <span className="text-purple-300 font-semibold bg-purple-800 px-3 py-1 rounded-lg">
                    Next Rank: #{nextRank}
                  </span>
                </div>
                
                {finishQueue.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-purple-300 mb-3">Finish Queue:</h4>
                    <div className="flex flex-wrap gap-3">
                      {finishQueue.map(finish => {
                        const athlete = athletes.find(a => a.id === finish.athleteId);
                        return (
                          <div key={finish.athleteId} className="bg-purple-800 bg-opacity-60 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 border border-purple-600">
                            <span className="text-white font-semibold">#{finish.rank} {athlete.name}</span>
                            <span className="text-purple-300 font-mono text-lg">{formatTime(finish.time)}</span>
                            <button
                              onClick={() => removeFromFinishQueue(finish.athleteId)}
                              className="text-purple-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={confirmFinishes}
                    disabled={finishQueue.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                  >
                    Confirm All Finishes ({finishQueue.length})
                  </button>
                  <button
                    onClick={() => {
                      setFinishQueue([]);
                      setNextRank(1);
                    }}
                    disabled={finishQueue.length === 0}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                  >
                    Clear Queue
                  </button>
                </div>
              </div>
            )}

            {/* Groups and Athletes */}
            <div className="space-y-6">
              {groups.map((group) => {
                const groupAthletes = athletes.filter(a => a.groupId === group.id);
                if (groupAthletes.length === 0) return null;

                const groupRestTime = restTimers[group.id];
                const hasGroupRest = currentSession.restDuration > 0 && currentSession.restMode === 'group' && groupRestTime !== undefined && groupRestTime >= 0;

                return (
                  <div key={group.id} className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                    <div className={`p-6 ${group.color} bg-opacity-80 text-white flex justify-between items-center`}>
                      <div className="flex items-center gap-4">
                        <Users size={24} />
                        <h3 className="text-xl font-semibold">{group.name}</h3>
                        <span className="text-sm opacity-90 bg-white bg-opacity-20 px-3 py-1 rounded-full">
                          {groupAthletes.length} swimmers
                        </span>
                      </div>
                      {hasGroupRest && (
                        <div className="flex items-center gap-3 bg-white bg-opacity-20 px-4 py-2 rounded-xl">
                          <Timer size={20} />
                          <span className="font-mono font-bold text-xl">{formatRestTime(groupRestTime)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="divide-y divide-gray-700">
                      {groupAthletes.map((athlete) => {
                        const athleteRestTime = restTimers[athlete.id];
                        const hasIndividualRest = currentSession.restDuration > 0 && currentSession.restMode === 'individual' && athleteRestTime !== undefined && athleteRestTime >= 0;
                        const inFinishQueue = finishQueue.some(f => f.athleteId === athlete.id);
                        const targetComparison = currentSession.targetTime ? getTargetComparison(athlete.time, currentSession.targetTime) : null;

                        return (
                          <div key={athlete.id} className={`p-6 transition-all duration-300 ${
                            inFinishQueue ? 'bg-purple-900 bg-opacity-50' : 'hover:bg-gray-750 hover:bg-opacity-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-lg ${
                                  athlete.isRunning ? 'bg-gradient-to-r from-green-600 to-green-700 animate-pulse' :
                                  athlete.isFinished ? 'bg-gradient-to-r from-blue-600 to-blue-700' :
                                  'bg-gradient-to-r from-gray-600 to-gray-700'
                                }`}>
                                  {athlete.lane}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-xl text-white">{athlete.name}</h3>
                                  <div className="flex items-center gap-3 mt-1">
                                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                                      athlete.isResting ? 'bg-orange-900 text-orange-200 border-orange-700' :
                                      athlete.isFinished ? 'bg-green-900 text-green-200 border-green-700' :
                                      athlete.isRunning ? 'bg-yellow-900 text-yellow-200 border-yellow-700' : 'bg-blue-900 text-blue-200 border-blue-700'
                                    }`}>
                                      {athlete.isResting ? 'RESTING' :
                                       athlete.isFinished ? 'FINISHED' : 
                                       athlete.isRunning ? 'SWIMMING' : 'READY'}
                                    </div>
                                    {hasIndividualRest && (
                                      <div className="flex items-center gap-2 text-orange-400 bg-orange-900 bg-opacity-50 px-3 py-1 rounded-full">
                                        <Timer size={16} />
                                        <span className="font-mono font-bold">{formatRestTime(athleteRestTime)}</span>
                                      </div>
                                    )}
                                    {inFinishQueue && (
                                      <div className="flex items-center gap-2 text-purple-300 bg-purple-900 bg-opacity-50 px-3 py-1 rounded-full">
                                        <Flag size={16} />
                                        <span className="font-bold">
                                          Rank #{finishQueue.find(f => f.athleteId === athlete.id)?.rank}
                                        </span>
                                      </div>
                                    )}
                                    {athlete.bestTime && (
                                      <div className="text-xs text-green-400 bg-green-900 bg-opacity-50 px-2 py-1 rounded border border-green-700">
                                        PB: {formatTime(athlete.bestTime)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-center">
                                <div className="text-4xl font-mono font-bold text-white mb-1">
                                  {formatTime(athlete.time)}
                                </div>
                                {targetComparison && athlete.time > 0 && (
                                  <div className={`text-sm font-medium ${
                                    targetComparison.faster ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {targetComparison.faster ? '−' : '+'}{targetComparison.difference}
                                  </div>
                                )}
                                {athlete.splits.length > 0 && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Splits: {athlete.splits.length}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-3">
                                {quickFinishMode ? (
                                  <button
                                    onClick={() => inFinishQueue ? removeFromFinishQueue(athlete.id) : addToFinishQueue(athlete.id)}
                                    disabled={athlete.isFinished || athlete.time === 0}
                                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                                      inFinishQueue
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                    } ${
                                      athlete.isFinished || athlete.time === 0
                                        ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''
                                    }`}
                                  >
                                    {inFinishQueue ? 'CANCEL' : `FINISH #${nextRank}`}
                                  </button>
                                ) : (
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => toggleAthlete(athlete.id)}
                                      disabled={athlete.isResting || (isRestPhase && !hasIndividualRest)}
                                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                                        athlete.isRunning 
                                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                                          : athlete.isFinished 
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                      } ${
                                        athlete.isResting || (isRestPhase && !hasIndividualRest) 
                                          ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {athlete.isRunning ? <Pause size={18} /> : athlete.isFinished ? <RotateCcw size={18} /> : <Play size={18} />}
                                        {athlete.isRunning ? 'PAUSE' : athlete.isFinished ? 'RESET' : 'START'}
                                      </div>
                                    </button>
                                    
                                    {/* Split button */}
                                    {athlete.isRunning && currentSession.distance > 50 && (
                                      <button
                                        onClick={() => recordSplit(athlete.id, currentSession.distance / 2)}
                                        className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                                      >
                                        <Activity size={18} />
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={() => finishAthlete(athlete.id)}
                                      disabled={(!athlete.isRunning && athlete.time === 0) || athlete.isResting}
                                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                                    >
                                      <Flag size={18} className="inline mr-2" />
                                      FINISH
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Split times display */}
                            {athlete.splits.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                  <Activity size={16} className="text-cyan-400" />
                                  <span className="text-sm font-medium text-gray-300">Split Times</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {athlete.splits.map((split, index) => (
                                    <div key={index} className="bg-cyan-900 bg-opacity-50 border border-cyan-600 rounded-lg px-3 py-1">
                                      <span className="text-xs text-cyan-300">{split.distance}m:</span>
                                      <span className="text-sm font-mono text-cyan-200 ml-1">{split.formattedTime}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Records View */
          <div className="bg-gray-800 bg-opacity-60 backdrop-blur-md rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                  <Medal className="text-yellow-400" size={28} />
                  Swimming Results
                </h2>
                {records.length > 0 && (
                  <div className="flex gap-3">
                    <button
                      onClick={exportData}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                    >
                      <Download size={18} className="inline mr-2" />
                      Export Results
                    </button>
                    <button
                      onClick={clearAllRecords}
                      className="text-red-400 hover:text-red-300 font-medium transition-colors px-4 py-2 rounded-xl hover:bg-red-900 hover:bg-opacity-20"
                    >
                      Clear All Results
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {records.length === 0 ? (
              <div className="text-center py-16">
                <Clock size={64} className="mx-auto text-gray-600 mb-6" />
                <p className="text-2xl text-gray-400 mb-3">No Results Yet</p>
                <p className="text-gray-500 text-lg">Finish swimmers to record their times</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {getGroupedRecords().map((group, groupIndex) => (
                  <div key={groupIndex} className="border-b border-gray-700 last:border-b-0">
                    {/* Group Header */}
                    <div className="bg-gray-750 bg-opacity-60 px-6 py-4 border-b border-gray-700">
                      <h3 className="font-semibold text-white text-lg flex items-center gap-3">
                        <Target size={20} className="text-blue-400" />
                        {group.sessionName} - Set {group.setNumber}
                        <span className="text-sm text-gray-400 font-normal">
                          ({group.distance}m {group.stroke})
                        </span>
                      </h3>
                    </div>
                    
                    {/* Results Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-750 bg-opacity-40">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Rank
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Lane
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Swimmer
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Group
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Time
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Target
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Splits
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-gray-800 bg-opacity-40 divide-y divide-gray-700">
                          {group.records.map((record, index) => {
                            const targetComparison = record.targetTime ? getTargetComparison(record.rawTime, record.targetTime) : null;
                            return (
                              <tr key={record.id} className="hover:bg-gray-750 hover:bg-opacity-60 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                                    index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                                    index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' : 
                                    index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-800' : 'bg-gradient-to-r from-blue-600 to-blue-800'
                                  }`}>
                                    {record.rank || index + 1}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="w-10 h-10 bg-gray-600 text-white rounded-lg flex items-center justify-center font-bold">
                                    {record.lane}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium text-white text-lg">{record.athleteName}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900 bg-opacity-60 text-blue-200 border border-blue-700">
                                    {record.groupName}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-3xl font-mono font-bold text-blue-400">
                                    {record.time}
                                  </div>
                                  {targetComparison && (
                                    <div className={`text-sm font-medium ${
                                      targetComparison.faster ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                      {targetComparison.faster ? '−' : '+'}{targetComparison.difference}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                                  {record.targetTime ? formatTime(record.targetTime) : '−'}
                                </td>
                                <td className="px-6 py-4">
                                  {record.splits && record.splits.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {record.splits.map((split, splitIndex) => (
                                        <div key={splitIndex} className="bg-cyan-900 bg-opacity-50 border border-cyan-600 rounded px-2 py-1 text-xs">
                                          <span className="text-cyan-300">{split.distance}m:</span>
                                          <span className="text-cyan-200 font-mono ml-1">{split.formattedTime}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">−</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                  {record.timestamp}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => deleteRecord(record.id)}
                                    className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-900 hover:bg-opacity-20"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}