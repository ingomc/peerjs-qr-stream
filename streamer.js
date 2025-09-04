export function initStreamerApp() {
  console.log('Streamer App wird initialisiert (Browser ist bereit)');
  const statusEl = document.getElementById('status');
  const localVideo = document.getElementById('local');
  const cameraSelect = document.getElementById('cameraSelect');
  const btnRefreshCameras = document.getElementById('btnRefreshCameras');
  const cameraStatus = document.getElementById('cameraStatus');
  const viewerId = new URL(location.href).searchParams.get('id');
  document.getElementById('viewer').textContent = viewerId || '(fehlt)';

  let localStream;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let availableCameras = [];
  let selectedCameraId = null;

  // 📹 KAMERA-AUSWAHL FUNKTIONEN
  async function loadAvailableCameras() {
    cameraStatus.textContent = '🧪 Teste Kamera-Kompatibilität...';
    cameraStatus.style.color = '#666';
    
    try {
      // Erst temporären Stream für Kamera-Erkennung starten
      const tempStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableCameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`📱 ${availableCameras.length} Kameras gefunden:`, availableCameras);
      cameraStatus.textContent = `🔍 ${availableCameras.length} Kameras gefunden, teste Kompatibilität...`;
      
      // Dropdown befüllen
      cameraSelect.innerHTML = '';
      
      if (availableCameras.length === 0) {
        cameraSelect.innerHTML = '<option value="">❌ Keine Kameras gefunden</option>';
        cameraStatus.textContent = '❌ Keine Kameras gefunden';
        cameraStatus.style.color = 'red';
        return;
      }
      
      // Standard-Option hinzufügen
      cameraSelect.innerHTML = '<option value="auto">🤖 Automatisch (Rückkamera bevorzugt)</option>';
      
      // KAMERA-KOMPATIBILITÄT TESTEN 🧪
      const workingCameras = [];
      const failedCameras = [];
      
      for (let i = 0; i < availableCameras.length; i++) {
        const camera = availableCameras[i];
        const label = camera.label || `Kamera ${i + 1}`;
        
        cameraStatus.textContent = `🧪 Teste ${i + 1}/${availableCameras.length}: ${label}`;
        
        try {
          console.log(`🧪 Teste Kamera: ${label} (${camera.deviceId.substring(0, 8)}...)`);
          
          // Mini-Test: Kamera kurz aktivieren
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: camera.deviceId },
              width: { ideal: 720, max: 720, min: 480 },     // 720p Maximum!
              height: { ideal: 1280, max: 1280, min: 640 }   // Hochkant 9:16
            },
            audio: false
          });
          
          // Test erfolgreich - Kamera funktioniert!
          const videoTrack = testStream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          testStream.getTracks().forEach(track => track.stop());
          
          console.log(`✅ Kamera funktioniert: ${settings.width}x${settings.height}`);
          
          const icon = label.toLowerCase().includes('front') || label.toLowerCase().includes('user') ? '🤳' : 
                      label.toLowerCase().includes('back') || label.toLowerCase().includes('environment') ? '📷' : '📹';
          
          // Qualitäts-Bewertung für 720p-Limit angepasst
          let qualityBadge = '';
          const totalPixels = settings.width * settings.height;
          if (totalPixels >= 720*1280) qualityBadge = ' 🏆'; // 720p Hochkant - MAXIMUM!
          else if (totalPixels >= 540*960) qualityBadge = ' ⭐'; // 540p Hochkant
          else if (totalPixels >= 360*640) qualityBadge = ' ✅'; // 360p Hochkant
          else qualityBadge = ' ⚠️'; // Sehr niedrig
          
          workingCameras.push({
            deviceId: camera.deviceId,
            label: label,
            icon: icon,
            resolution: `${settings.width}x${settings.height}`,
            qualityBadge: qualityBadge,
            pixels: totalPixels
          });
          
        } catch (testErr) {
          console.warn(`❌ Kamera nicht funktionsfähig: ${label} (${testErr.message})`);
          failedCameras.push({ label, error: testErr.message });
        }
      }
      
      console.log(`✅ ${workingCameras.length} von ${availableCameras.length} Kameras sind funktionsfähig`);
      
      // Nach Qualität sortieren (höchste Auflösung zuerst)
      workingCameras.sort((a, b) => b.pixels - a.pixels);
      
      // Nur funktionierende Kameras hinzufügen
      workingCameras.forEach((camera) => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = `${camera.icon} ${camera.label} (${camera.resolution})${camera.qualityBadge}`;
        cameraSelect.appendChild(option);
      });
      
      // Status-Update
      if (workingCameras.length === 0) {
        cameraSelect.innerHTML += '<option value="">⚠️ Keine funktionsfähigen Kameras gefunden</option>';
        cameraStatus.textContent = '❌ Alle Kameras fehlgeschlagen - verwende Automatik';
        cameraStatus.style.color = 'red';
      } else {
        cameraStatus.textContent = `✅ ${workingCameras.length} funktionsfähige Kameras gefunden`;
        cameraStatus.style.color = 'green';
        
        if (failedCameras.length > 0) {
          cameraStatus.textContent += ` (${failedCameras.length} übersprungen)`;
          cameraStatus.style.color = '#ff8800';  // Orange
        }
      }
      
      console.log('✅ Kamera-Dropdown mit getesteten Kameras aktualisiert');
    } catch (err) {
      console.error('❌ Fehler beim Laden der Kameras:', err);
      cameraSelect.innerHTML = '<option value="">❌ Fehler beim Laden der Kameras</option>';
      cameraStatus.textContent = `❌ Fehler: ${err.message}`;
      cameraStatus.style.color = 'red';
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
      // � OPTIMIERT für 720p Hochkant-Beamer mit Orientierungs-Erhaltung
      const videoConstraints = {
        width: { ideal: 720, max: 720, min: 540 },      // 720p MAXIMUM - mehr geht nicht!
        height: { ideal: 1280, max: 1280, min: 960 },   // Hochkant 9:16 Format
        frameRate: { ideal: 30, max: 30, min: 24 },     // Stabile 30fps
        // WICHTIG: Orientierung beibehalten
        advanced: [
          { width: { min: 540, ideal: 720, max: 720 } },       // 720p Breite MAX
          { height: { min: 960, ideal: 1280, max: 1280 } },    // Hochkant Höhe MAX  
          { frameRate: { min: 24, ideal: 30, max: 30 } },
          { aspectRatio: { ideal: 0.5625 } }                   // 9:16 = 0.5625
        ],
        // Orientierung NICHT umdrehen!
        facingMode: selectedCameraId ? undefined : { ideal: 'environment' }
      };

      // Kamera-ID hinzufügen wenn spezifische Kamera ausgewählt
      if (selectedCameraId) {
        videoConstraints.deviceId = { exact: selectedCameraId };
        delete videoConstraints.facingMode; // Keine facingMode-Konflikte
        console.log('📷 Verwende spezifische Kamera mit 720p MAXIMUM:', selectedCameraId);
      } else {
        console.log('🤖 Automatische Kamera-Auswahl mit 720p MAXIMUM (Rückkamera bevorzugt)');
      }

      // 🎯 720p Hochkant-Beamer OPTIMIERT
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,  // Hi-Fi Audio
          sampleSize: 16,     // 16-bit Audio
          channelCount: 2     // Stereo
        }
      });
      console.log('� Kamera mit 720p MAXIMUM HOCHKANT-Qualität aktiviert!');
      console.log('📹 Video Settings (720p HOCHKANT):', localStream.getVideoTracks()[0].getSettings());
      console.log('🔊 Audio Settings (HI-FI):', localStream.getAudioTracks()[0].getSettings());
      
    } catch (err) {
      console.warn('⚠️ 720p Maximum nicht verfügbar, versuche niedrigere Qualität:', err.message);
      
      // 🛡️ FALLBACK 1: 540p Hochkant (mittlere Qualität)
      try {
        const fallbackConstraints = {
          width: { ideal: 540, max: 720, min: 480 },
          height: { ideal: 960, max: 1280, min: 854 },
          frameRate: { ideal: 30, max: 30, min: 20 },
          advanced: [
            { width: { min: 480, ideal: 540, max: 720 } },
            { height: { min: 854, ideal: 960, max: 1280 } },
            { frameRate: { min: 20, ideal: 30, max: 30 } },
            { aspectRatio: { ideal: 0.5625 } }
          ]
        };
        
        if (selectedCameraId) {
          fallbackConstraints.deviceId = { exact: selectedCameraId };
        } else {
          fallbackConstraints.facingMode = { ideal: 'environment' };
        }
        
        console.log('🔄 Fallback 1: 540p Hochkant-Qualität...');
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: fallbackConstraints, 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
            channelCount: 2
          }
        });
        console.log('⭐ Fallback 1 erfolgreich - 540p Hochkant-Qualität');
      } catch (fallback1Err) {
        console.warn('❌ Fallback 1 fehlgeschlagen:', fallback1Err.message);
        
        // 🛡️ FALLBACK 2: Beliebige Qualität, aber Hochkant bevorzugt
        try {
          const emergencyConstraints = {
            width: { ideal: 480, max: 720, min: 320 },
            height: { ideal: 854, max: 1280, min: 480 },
            frameRate: { ideal: 30, min: 15 }
          };
          
          if (selectedCameraId) {
            emergencyConstraints.deviceId = { exact: selectedCameraId };
            console.log('🔄 Fallback 2: Beliebige Qualität mit gewählter Kamera...');
          } else {
            emergencyConstraints.facingMode = 'environment';
            console.log('🔄 Fallback 2: Beliebige Hochkant-Qualität...');
          }
          
          localStream = await navigator.mediaDevices.getUserMedia({ 
            video: emergencyConstraints, 
            audio: { echoCancellation: true, sampleRate: 48000 }
          });
          console.log('✅ Fallback 2 erfolgreich - Basis-Qualität erhalten');
        } catch (fallback2Err) {
          console.warn('❌ Fallback 2 fehlgeschlagen:', fallback2Err.message);
          
          // 🛡️ FALLBACK 3: Absoluter Notfall - beliebige Kamera
          if (selectedCameraId) {
            selectedCameraId = null; // Reset für automatische Auswahl
          }
          
          console.log('🔄 Fallback 3: Notfall - beliebige verfügbare Kamera...');
          localStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 720, min: 320 },
              height: { ideal: 1280, min: 240 },
              frameRate: { ideal: 30, min: 10 }
            }, 
            audio: { echoCancellation: true }
          });
          console.log('🆘 Fallback 3 erfolgreich - Notfall-Modus');
        }
      }
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
                  
                  // 🎯 OPTIMIERTE Bitrate für 720p HOCHKANT (dynamisch basierend auf Auflösung)
                  if (params.encodings && params.encodings.length > 0) {
                    // Berechne optimale Bitrate basierend auf echte 720p-Limits
                    const videoTrack = localStream.getVideoTracks()[0];
                    const settings = videoTrack.getSettings();
                    const pixels = settings.width * settings.height;
                    
                    let targetBitrate;
                    if (pixels >= 720*1280) {
                      targetBitrate = 6000000;  // 6 Mbps für 720p Hochkant (MAXIMUM!)
                    } else if (pixels >= 540*960) {
                      targetBitrate = 4500000;  // 4.5 Mbps für 540p Hochkant
                    } else if (pixels >= 360*640) {
                      targetBitrate = 3000000;  // 3 Mbps für 360p Hochkant
                    } else {
                      targetBitrate = 2000000;  // 2 Mbps für niedrige Auflösung
                    }
                    
                    params.encodings[0].maxBitrate = targetBitrate;
                    params.encodings[0].maxFramerate = settings.frameRate || 30;
                    
                    console.log(`🎯 720p-optimierte Bitrate gesetzt: ${targetBitrate/1000000} Mbps für ${settings.width}x${settings.height} HOCHKANT!`);
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
