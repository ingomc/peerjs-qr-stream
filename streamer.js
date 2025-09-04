export function initStreamerApp() {
  console.log('Streamer App wird initialisiert (Browser ist bereit)');
  const statusEl = document.getElementById('status');
  const localVideo = document.getElementById('local');
  const cameraSelect = document.getElementById('cameraSelect');
  const btnRefreshCameras = document.getElementById('btnRefreshCameras');
  const viewerId = new URL(location.href).searchParams.get('id');
  document.getElementById('viewer').textContent = viewerId || '(fehlt)';

  let localStream;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let availableCameras = [];
  let selectedCameraId = null;

  // 📹 KAMERA-AUSWAHL FUNKTIONEN
  async function loadAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableCameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`📱 ${availableCameras.length} Kameras gefunden:`, availableCameras);
      
      // Dropdown befüllen
      cameraSelect.innerHTML = '';
      
      if (availableCameras.length === 0) {
        cameraSelect.innerHTML = '<option value="">❌ Keine Kameras gefunden</option>';
        return;
      }
      
      // Standard-Option hinzufügen
      cameraSelect.innerHTML = '<option value="auto">🤖 Automatisch (Rückkamera bevorzugt)</option>';
      
      // Alle verfügbaren Kameras hinzufügen
      availableCameras.forEach((camera, index) => {
        const label = camera.label || `Kamera ${index + 1}`;
        const icon = label.toLowerCase().includes('front') || label.toLowerCase().includes('user') ? '🤳' : 
                    label.toLowerCase().includes('back') || label.toLowerCase().includes('environment') ? '📷' : '📹';
        
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = `${icon} ${label}`;
        cameraSelect.appendChild(option);
      });
      
      console.log('✅ Kamera-Dropdown aktualisiert');
    } catch (err) {
      console.error('❌ Fehler beim Laden der Kameras:', err);
      cameraSelect.innerHTML = '<option value="">❌ Fehler beim Laden der Kameras</option>';
    }
  }

  // Kamera-Auswahl Event Handler
  cameraSelect.addEventListener('change', () => {
    selectedCameraId = cameraSelect.value === 'auto' ? null : cameraSelect.value;
    console.log('📷 Kamera ausgewählt:', selectedCameraId || 'Automatisch');
    
    // Stream neu starten wenn bereits aktiv
    if (localStream) {
      console.log('🔄 Stream wird mit neuer Kamera neu gestartet...');
      localStream.getTracks().forEach(track => track.stop());
      getCam();
    }
  });

  // Kameras neu laden Button
  btnRefreshCameras.addEventListener('click', loadAvailableCameras);

  async function getCam() {
    try {
      // Kamera-spezifische Einstellungen
      const videoConstraints = {
        width: { ideal: 608, min: 540 },  // 9:16 Breite für 1080p
        height: { ideal: 1080, min: 960 }, // Volle Beamer-Höhe
        frameRate: { ideal: 30, min: 24 }, // Flüssige 30fps
        // Hochkant-optimierte Einstellungen
        advanced: [
          { width: { min: 540, ideal: 608 } },    // 9:16 Verhältnis
          { height: { min: 960, ideal: 1080 } },  // Full-HD Höhe
          { frameRate: { min: 24, ideal: 30 } },
          { aspectRatio: { ideal: 0.5625 } }      // 9:16 = 0.5625
        ]
      };

      // Kamera-ID hinzufügen wenn spezifische Kamera ausgewählt
      if (selectedCameraId) {
        videoConstraints.deviceId = { exact: selectedCameraId };
        console.log('📷 Verwende spezifische Kamera:', selectedCameraId);
      } else {
        // Automatisch: Rückkamera bevorzugen
        videoConstraints.facingMode = { ideal: 'environment' };
        console.log('🤖 Automatische Kamera-Auswahl (Rückkamera bevorzugt)');
      }

      // OPTIMIERT für Hochkant-Beamer (9:16 Format, 1080p Höhe)
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Gute Audio-Qualität
          channelCount: 2
        }
      });
      console.log('✅ Kamera mit BEAMER-optimierter Qualität aktiviert (9:16)');
      console.log('📹 Video Settings (BEAMER-FORMAT):', localStream.getVideoTracks()[0].getSettings());
      console.log('🔊 Audio Settings:', localStream.getAudioTracks()[0].getSettings());
    } catch (err) {
      console.log('⚠️ Gewählte Kamera nicht verfügbar, versuche Fallback:', err.message);
      // Fallback: Frontkamera - auch beamer-optimiert
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 540, min: 480 },   // Reduzierte, aber immer noch 9:16
          height: { ideal: 960, min: 854 },  // Reduzierte, aber gute Höhe
          frameRate: { ideal: 30, min: 20 },
          facingMode: 'user',
          advanced: [
            { aspectRatio: { ideal: 0.5625 } }  // 9:16 auch bei Frontkamera
          ]
        }, 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      });
      console.log('✅ Fallback-Kamera mit Beamer-Format aktiviert (9:16)');
    }
    
    localVideo.srcObject = localStream;
    
    // WICHTIG: Beamer-Format prüfen
    const videoTrack = localStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const aspectRatio = settings.width / settings.height;
    
    console.log(`🎥 BEAMER-QUALITÄT: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
    console.log(`📐 Seitenverhältnis: ${aspectRatio.toFixed(3)} (SOLL: 0.563 für 9:16)`);
    
    if (aspectRatio > 0.7) {
      console.warn('⚠️ WARNUNG: Format zu breit für Hochkant-Beamer!');
    } else if (aspectRatio >= 0.5 && aspectRatio <= 0.6) {
      console.log('✅ PERFEKTES 9:16 FORMAT für Beamer bestätigt!');
    }
    
    if (settings.height < 960) {
      console.warn('⚠️ WARNUNG: Höhe zu niedrig für Full-HD-Beamer!');
    } else {
      console.log('✅ Optimale Höhe für 1080p Beamer');
    }
    
    console.log('📊 Stream erstellt:', localStream.getVideoTracks().length, 'Video +', localStream.getAudioTracks().length, 'Audio tracks');
  }

  function createPeer() {
    return new Peer({
      config: {
        'iceServers': [
          // Google's öffentliche STUN Server
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // Alternative STUN Server
          { urls: 'stun:stun.relay.metered.ca:80' },
          // Robuste TURN Server Konfiguration
          {
            urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          // Zusätzliche kostenlose TURN Server
          {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efSCKZqnZbF2RfHZ68',
            credential: 'web@anyfirewall.com'
          }
        ],
        'iceCandidatePoolSize': 10,
        'bundlePolicy': 'balanced',
        'rtcpMuxPolicy': 'require',
        // Für Galaxy S25U -> M1 Mac Kompatibilität
        'sdpSemantics': 'unified-plan'
      }
    });
  }

  async function startConnection() {
    if (!viewerId) { alert('Viewer-ID fehlt (?id=...)'); return; }
    statusEl.textContent = 'Status: initialisiere Kamera…';
    
    try {
      await getCam();
      statusEl.textContent = 'Status: verbinde…';

      const peer = createPeer();
      
      peer.on('open', (id) => {
        console.log('Peer geöffnet mit ID:', id);
        console.log('Rufe Viewer an:', viewerId);
        
        const call = peer.call(viewerId, localStream);
        
        // Codec-Optimierung für Galaxy S25U -> MacBook M1
        setTimeout(async () => {
          if (call.peerConnection) {
            // Video-Codec-Priorität setzen: H264 ZUERST (beste Kompatibilität Galaxy<->Mac)
            const transceivers = call.peerConnection.getTransceivers();
            transceivers.forEach(async transceiver => {
              if (transceiver.sender && transceiver.sender.track && transceiver.sender.track.kind === 'video') {
                const params = transceiver.sender.getParameters();
                if (params.codecs) {
                  // H264 als ersten Codec setzen - PERFEKT für Galaxy S25U -> M1 Mac!
                  params.codecs = params.codecs.sort((a, b) => {
                    if (a.mimeType.includes('H264')) return -1;
                    if (b.mimeType.includes('H264')) return 1;
                    if (a.mimeType.includes('VP8')) return -1;
                    if (b.mimeType.includes('VP8')) return 1;
                    return 0;
                  });
                  console.log('🎥 Video Codecs priorisiert:', params.codecs.map(c => c.mimeType));
                  await transceiver.sender.setParameters(params);
                }
              }
              
              // Audio-Codec-Priorität: Opus (optimal für beide Geräte)
              if (transceiver.sender && transceiver.sender.track && transceiver.sender.track.kind === 'audio') {
                const params = transceiver.sender.getParameters();
                if (params.codecs) {
                  params.codecs = params.codecs.sort((a, b) => {
                    if (a.mimeType.includes('opus')) return -1;
                    if (b.mimeType.includes('opus')) return 1;
                    return 0;
                  });
                  console.log('🔊 Audio Codecs priorisiert:', params.codecs.map(c => c.mimeType));
                  await transceiver.sender.setParameters(params);
                }
              }
            });
            
            // WICHTIG: Bitrate forcieren für hohe Qualität
            setTimeout(async () => {
              const senders = call.peerConnection.getSenders();
              senders.forEach(async sender => {
                if (sender.track && sender.track.kind === 'video') {
                  const params = sender.getParameters();
                  
                  // BEAMER-optimierte Bitrate (5 Mbps für 608x1080 ausreichend)
                  if (params.encodings && params.encodings.length > 0) {
                    params.encodings[0].maxBitrate = 5000000; // 5 Mbps - perfekt für 9:16 Format!
                    params.encodings[0].maxFramerate = 30;
                    
                    console.log('🎯 Video Bitrate auf 5 Mbps gesetzt für BEAMER-Streaming (9:16)!');
                    await sender.setParameters(params);
                  }
                }
                
                if (sender.track && sender.track.kind === 'audio') {
                  const params = sender.getParameters();
                  if (params.encodings && params.encodings.length > 0) {
                    params.encodings[0].maxBitrate = 128000; // 128 kbps Audio
                    console.log('🔊 Audio Bitrate auf 128 kbps gesetzt');
                    await sender.setParameters(params);
                  }
                }
              });
            }, 1000);
            
            call.peerConnection.addEventListener('iceconnectionstatechange', () => {
              const state = call.peerConnection.iceConnectionState;
              console.log('ICE Connection State:', state);
              if (state === 'failed') {
                statusEl.textContent = 'Status: Verbindung fehlgeschlagen ❌';
                console.log('🔍 Mögliche Ursachen: Firewall, NAT, oder Codec-Inkompatibilität');
                if (reconnectAttempts < maxReconnectAttempts) {
                  reconnectAttempts++;
                  setTimeout(() => {
                    statusEl.textContent = `Status: Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
                    peer.destroy();
                    startConnection();
                  }, 2000);
                }
              } else if (state === 'disconnected') {
                statusEl.textContent = 'Status: Verbindung unterbrochen 🔄';
                console.log('🔍 Stream-Unterbrechung - möglicherweise Netzwerk-Problem');
              } else if (state === 'connected' || state === 'completed') {
                console.log('✅ P2P Verbindung erfolgreich hergestellt!');
                console.log('🎥 Stream sollte jetzt übertragen werden');
                statusEl.textContent = 'Status: Anruf gestartet ✅';
                reconnectAttempts = 0;
              } else if (state === 'connecting') {
                statusEl.textContent = 'Status: verbinde 🔄';
              }
            });
            
            // Zusätzliches Connection State Monitoring
            call.peerConnection.addEventListener('connectionstatechange', () => {
              const state = call.peerConnection.connectionState;
              console.log('Connection State:', state);
            });
          }
        }, 100);
        
        call.on('close', () => {
          statusEl.textContent = 'Status: Verbindung beendet';
          console.log('Anruf beendet');
        });
        
        call.on('error', e => { 
          statusEl.textContent = 'Fehler (Call): ' + e.type; 
          console.error('Call Fehler:', e); 
        });
      });
      
      peer.on('error', e => { 
        statusEl.textContent = 'Fehler: ' + e.type; 
        console.error('Peer Fehler:', e); 
        
        if (e.type === 'peer-unavailable') {
          statusEl.textContent = 'Fehler: Viewer nicht erreichbar ❌';
        }

        // Auto-reconnect bei Peer-Fehlern
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(() => {
            statusEl.textContent = `Status: Peer Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
            peer.destroy();
            startConnection();
          }, 3000);
        }
      });
      
    } catch (err) {
      statusEl.textContent = 'Kamera-Fehler: ' + err.message;
      console.error('Kamera-Fehler:', err);
    }
  }

  document.getElementById('btnStart').addEventListener('click', startConnection);
  
  // 📷 KAMERA-AUSWAHL beim Start laden
  loadAvailableCameras();
}
