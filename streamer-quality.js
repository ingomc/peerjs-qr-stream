export function initStreamerApp() {
  console.log('📱 Multi-Device Streamer App mit Qualitätsstufen');
  const statusEl = document.getElementById('status');
  const localVideo = document.getElementById('local');
  const cameraSelect = document.getElementById('cameraSelect');
  const btnRefreshCameras = document.getElementById('btnRefreshCameras');
  const cameraStatus = document.getElementById('cameraStatus');
  const qualitySelect = document.getElementById('qualitySelect');
  const debugConsole = document.getElementById('debugConsole');
  const clearDebugBtn = document.getElementById('clearDebug');
  const viewerId = new URL(location.href).searchParams.get('id');
  document.getElementById('viewer').textContent = viewerId || '(fehlt)';

  let localStream;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let peer;
  let selectedQuality = 'medium';

  // 🐛 DEBUG CONSOLE
  function debugLog(message, type = 'info') {
    if (!debugConsole) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '#0f0',
      warn: '#ff0', 
      error: '#f00',
      success: '#0f0'
    };
    
    const logEntry = document.createElement('div');
    logEntry.style.color = colors[type] || '#0f0';
    logEntry.innerHTML = `[${timestamp}] ${message}`;
    
    debugConsole.appendChild(logEntry);
    debugConsole.scrollTop = debugConsole.scrollHeight;
    
    // Auch in normale Console
    console.log(`[DEBUG] ${message}`);
  }

  // Clear Debug Button
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener('click', () => {
      if (debugConsole) debugConsole.innerHTML = '';
    });
  }

  // Startup Debug
  debugLog('🚀 Streamer initialisiert');
  debugLog(`📱 Viewer-ID: ${viewerId || 'FEHLT!'}`);
  debugLog(`🌐 User-Agent: ${navigator.userAgent.substring(0, 50)}...`);

  // 🎯 QUALITÄTSSTUFEN für Internet-Verbindungen
  const QUALITY_CONFIGS = {
    'ultra-low': {
      video: { width: 320, height: 240, frameRate: 15 },
      audio: { sampleRate: 16000, channelCount: 1 }
    },
    'low': {
      video: { width: 640, height: 480, frameRate: 20 },
      audio: { sampleRate: 22050, channelCount: 1 }
    },
    'medium': {
      video: { width: 1280, height: 720, frameRate: 25 },
      audio: { sampleRate: 44100, channelCount: 1 }
    },
    'high': {
      video: { width: 1920, height: 1080, frameRate: 30 },
      audio: { sampleRate: 48000, channelCount: 2 }
    }
  };

  // Quality Select Handler
  if (qualitySelect) {
    qualitySelect.addEventListener('change', () => {
      selectedQuality = qualitySelect.value;
      debugLog(`🎯 Qualität geändert zu: ${selectedQuality}`);
      
      if (localStream) {
        debugLog('🔄 Stream wird neu gestartet...');
        localStream.getTracks().forEach(track => track.stop());
        getCam();
      }
    });
  }

  // Internet-optimierter Peer mit TURN-Server
  function createPeer() {
    debugLog('🔧 Erstelle Peer mit TURN-Server...', 'info');
    
    const config = {
      'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: [
            'turn:relay1.expressturn.com:3478',
            'turn:relay1.expressturn.com:3478?transport=tcp'
          ],
          username: 'efSCKZqnZbF2RfHZ68',
          credential: 'web@anyfirewall.com'
        }
      ],
      'iceCandidatePoolSize': 30,
      'bundlePolicy': 'max-bundle',
      'rtcpMuxPolicy': 'require',
      'iceTransportPolicy': 'relay', // FORCIERE TURN-Server
      'sdpSemantics': 'unified-plan'
    };
    
    debugLog(`🌐 ICE-Server Anzahl: ${config.iceServers.length}`);
    debugLog('⚡ TURN-Server werden forciert (relay only)');
    
    return new Peer({ config });
  }

  async function getCam() {
    try {
      const config = QUALITY_CONFIGS[selectedQuality];
      debugLog(`🎥 Starte Kamera: ${selectedQuality.toUpperCase()} (${config.video.width}x${config.video.height}@${config.video.frameRate}fps)`);
      statusEl.textContent = `Kamera wird geladen (${selectedQuality.toUpperCase()})...`;
      
      const constraints = {
        video: {
          width: { ideal: config.video.width },
          height: { ideal: config.video.height },
          frameRate: { ideal: config.video.frameRate },
          facingMode: { ideal: 'environment' }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: config.audio.sampleRate,
          channelCount: config.audio.channelCount
        }
      };

      debugLog('📹 getUserMedia wird aufgerufen...');
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];
      const videoSettings = videoTrack.getSettings();
      const audioSettings = audioTrack.getSettings();
      
      debugLog(`✅ Kamera OK: ${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps`, 'success');
      debugLog(`🔊 Audio: ${audioSettings.sampleRate}Hz, ${audioSettings.channelCount} Kanäle`, 'success');
      
      localVideo.srcObject = localStream;
      statusEl.textContent = `Kamera bereit: ${selectedQuality.toUpperCase()} (${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps)`;
      
    } catch (err) {
      debugLog(`❌ Kamera-Fehler: ${err.name} - ${err.message}`, 'error');
      statusEl.textContent = 'Kamera-Fehler: ' + err.message;
      
      // Fallback zu Ultra Low
      if (selectedQuality !== 'ultra-low') {
        debugLog('🔄 Versuche Fallback zu Ultra Low...', 'warn');
        selectedQuality = 'ultra-low';
        qualitySelect.value = 'ultra-low';
        
        try {
          const ultraConfig = QUALITY_CONFIGS['ultra-low'];
          localStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: ultraConfig.video.width },
              height: { ideal: ultraConfig.video.height },
              frameRate: { ideal: ultraConfig.video.frameRate },
              facingMode: { ideal: 'environment' }
            },
            audio: ultraConfig.audio
          });
          
          localVideo.srcObject = localStream;
          statusEl.textContent = `Fallback: ULTRA LOW aktiviert`;
          debugLog('✅ Ultra Low Fallback erfolgreich', 'success');
          
        } catch (fallbackErr) {
          debugLog(`❌ Auch Fallback fehlgeschlagen: ${fallbackErr.message}`, 'error');
          statusEl.textContent = 'Kamera nicht verfügbar';
        }
      }
    }
  }

  async function startConnection() {
    if (!viewerId) {
      debugLog('❌ Viewer-ID fehlt in URL!', 'error');
      alert('Viewer-ID fehlt (?id=...)');
      return;
    }
    
    debugLog(`🚀 Starte Verbindung zu Viewer: ${viewerId}`);
    statusEl.textContent = 'Verbinde mit TURN-Server...';
    
    try {
      await getCam();
      
      debugLog('🔧 Erstelle Peer-Verbindung...', 'info');
      peer = createPeer();
      
      peer.on('open', id => {
        debugLog(`✅ Peer erfolgreich verbunden! ID: ${id}`, 'success');
        statusEl.textContent = 'Peer verbunden - starte Stream...';
        
        debugLog(`📞 Rufe Viewer an: ${viewerId}`);
        const call = peer.call(viewerId, localStream);
        
        // 💬 DATA CHANNEL für Text-Nachrichten einrichten
        let dataChannel = null;
        
        if (call.peerConnection) {
          debugLog('📨 Erstelle DataChannel für Text-Nachrichten...');
          dataChannel = call.peerConnection.createDataChannel('messages', {
            ordered: true
          });
          
          dataChannel.addEventListener('open', () => {
            debugLog('✅ DataChannel ist geöffnet - kann Nachrichten senden!');
            // Test-Nachricht an Viewer senden
            dataChannel.send('📱 Hallo vom Handy! DataChannel Test 🚀');
            
            // Weitere Test-Nachrichten
            setTimeout(() => dataChannel.send('📱 5 Sekunden Test-Nachricht'), 5000);
            setTimeout(() => dataChannel.send('📱 10 Sekunden - funktioniert DataChannel?'), 10000);
          });
          
          dataChannel.addEventListener('message', (event) => {
            debugLog(`💬 Antwort vom Viewer: "${event.data}"`);
            // Weitere Antworten senden
            if (dataChannel.readyState === 'open') {
              dataChannel.send(`📱 Handy bestätigt: DataChannel funktioniert! 👍`);
            }
          });
          
          dataChannel.addEventListener('error', (error) => {
            debugLog(`❌ DataChannel Fehler: ${error}`, 'error');
          });
          
          dataChannel.addEventListener('close', () => {
            debugLog('📪 DataChannel geschlossen');
          });
        }
        
        call.on('stream', remoteStream => {
          debugLog('📺 Remote-Stream empfangen (ungewöhnlich für Streamer)', 'info');
        });

        call.on('close', () => {
          debugLog('📴 Call wurde beendet', 'warn');
          statusEl.textContent = 'Stream beendet';
        });

        call.on('error', err => {
          debugLog(`❌ Call-Fehler: ${err.type} - ${err.message}`, 'error');
          statusEl.textContent = 'Stream-Fehler: ' + err.message;
        });

        // ICE Connection State überwachen - WICHTIG für TURN-Server Debug!
        if (call.peerConnection) {
          debugLog('🧊 ICE Connection State Monitoring aktiviert');
          
          call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            debugLog(`🧊 ICE State geändert zu: ${state}`, state === 'connected' ? 'success' : 'warn');
            
            if (state === 'connected') {
              statusEl.textContent = `✅ Stream läuft über TURN-Server! (${selectedQuality.toUpperCase()})`;
            } else if (state === 'disconnected') {
              statusEl.textContent = '⚠️ Verbindung unterbrochen...';
              debugLog('⚠️ ICE Verbindung unterbrochen - könnte TURN-Server Problem sein', 'warn');
            } else if (state === 'failed') {
              statusEl.textContent = '❌ Stream fehlgeschlagen';
              debugLog('❌ ICE Connection failed! TURN-Server nicht erreichbar oder überlastet', 'error');
            } else if (state === 'checking') {
              debugLog('🔍 ICE prüft Verbindungsmöglichkeiten (TURN-Server werden getestet)...');
            } else if (state === 'new') {
              debugLog('🆕 ICE Connection initialisiert');
            }
          });

          // ICE Candidate Events - zeigt TURN-Server Aktivität
          call.peerConnection.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
              const candidate = event.candidate;
              debugLog(`🧊 ICE Candidate: ${candidate.type} (${candidate.protocol}) - ${candidate.address || 'relay'}`);
              
              if (candidate.type === 'relay') {
                debugLog('🌐 TURN-Server Relay Candidate gefunden!', 'success');
              }
            } else {
              debugLog('🧊 ICE Gathering abgeschlossen');
            }
          });

          // Connection State (zusätzlich zu ICE State)
          call.peerConnection.addEventListener('connectionstatechange', () => {
            const state = call.peerConnection.connectionState;
            debugLog(`🔗 Connection State: ${state}`);
          });
        }
      });

      peer.on('error', err => {
        debugLog(`❌ Peer-Fehler: ${err.type} - ${err.message}`, 'error');
        
        if (err.type === 'network') {
          debugLog('🌐 Netzwerk-Fehler: Möglicherweise TURN-Server nicht erreichbar', 'error');
        } else if (err.type === 'peer-unavailable') {
          debugLog('👻 Viewer nicht erreichbar: ID existiert nicht oder offline', 'error');
        } else if (err.type === 'server-error') {
          debugLog('🖥️ PeerJS Server-Fehler: Verbindung zur Signaling-Server fehlgeschlagen', 'error');
        }
        
        statusEl.textContent = 'Peer-Fehler: ' + err.message;
      });

      peer.on('disconnected', () => {
        debugLog('🔌 Peer getrennt - versuche Reconnect...', 'warn');
        statusEl.textContent = 'Peer getrennt - Reconnect...';
      });
      
    } catch (err) {
      debugLog(`❌ Verbindungsfehler: ${err.message}`, 'error');
      statusEl.textContent = 'Verbindung fehlgeschlagen: ' + err.message;
    }
  }

  // Auto-Start
  if (viewerId) {
    const btnStart = document.getElementById('btnStart');
    if (btnStart) {
      btnStart.addEventListener('click', startConnection);
    }
    
    // Auto-start für QR-Code Links
    startConnection();
  } else {
    statusEl.textContent = 'Fehler: Viewer-ID fehlt in URL (?id=...)';
  }
}
