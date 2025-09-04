export function initStreamerApp() {
  console.log('📱 Multi-Device Streamer App mit Qualitätsstufen');
  const statusEl = document.getElementById('status');
  const localVideo = document.getElementById('local');
  const cameraSelect = document.getElementById('cameraSelect');
  const btnRefreshCameras = document.getElementById('btnRefreshCameras');
  const cameraStatus = document.getElementById('cameraStatus');
  const qualitySelect = document.getElementById('qualitySelect');
  const viewerId = new URL(location.href).searchParams.get('id');
  document.getElementById('viewer').textContent = viewerId || '(fehlt)';

  let localStream;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let peer;
  let selectedQuality = 'medium';

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
      console.log('🎯 Qualität geändert zu:', selectedQuality);
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        getCam();
      }
    });
  }

  // Internet-optimierter Peer mit TURN-Server
  function createPeer() {
    return new Peer({
      config: {
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
      }
    });
  }

  async function getCam() {
    try {
      const config = QUALITY_CONFIGS[selectedQuality];
      console.log(`🎥 Starte Kamera mit ${selectedQuality.toUpperCase()} Qualität`);
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

      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTrack = localStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      localVideo.srcObject = localStream;
      statusEl.textContent = `Kamera bereit: ${selectedQuality.toUpperCase()} (${settings.width}x${settings.height}@${settings.frameRate}fps)`;
      
      console.log(`✅ Kamera aktiviert: ${settings.width}x${settings.height}@${settings.frameRate}fps`);
      
    } catch (err) {
      console.error('❌ Kamera-Fehler:', err);
      statusEl.textContent = 'Kamera-Fehler: ' + err.message;
      
      // Fallback zu Ultra Low
      if (selectedQuality !== 'ultra-low') {
        console.log('🔄 Fallback zu Ultra Low...');
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
          console.log('✅ Ultra Low Fallback erfolgreich');
          
        } catch (fallbackErr) {
          console.error('❌ Auch Fallback fehlgeschlagen:', fallbackErr);
          statusEl.textContent = 'Kamera nicht verfügbar';
        }
      }
    }
  }

  async function startConnection() {
    if (!viewerId) {
      alert('Viewer-ID fehlt (?id=...)');
      return;
    }
    
    statusEl.textContent = 'Verbinde mit TURN-Server...';
    
    try {
      await getCam();
      
      peer = createPeer();
      
      peer.on('open', id => {
        console.log('✅ Peer verbunden:', id);
        statusEl.textContent = 'Peer verbunden - starte Stream...';
        
        const call = peer.call(viewerId, localStream);
        
        call.on('stream', remoteStream => {
          console.log('📺 Remote-Stream empfangen');
        });

        call.on('close', () => {
          console.log('📴 Call beendet');
          statusEl.textContent = 'Stream beendet';
        });

        call.on('error', err => {
          console.error('❌ Call-Fehler:', err);
          statusEl.textContent = 'Stream-Fehler: ' + err.message;
        });

        // ICE Connection State überwachen
        if (call.peerConnection) {
          call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            console.log('🧊 ICE State:', state);
            
            if (state === 'connected') {
              statusEl.textContent = `✅ Stream läuft über TURN-Server! (${selectedQuality.toUpperCase()})`;
            } else if (state === 'disconnected') {
              statusEl.textContent = '⚠️ Verbindung unterbrochen...';
            } else if (state === 'failed') {
              statusEl.textContent = '❌ Stream fehlgeschlagen - versuche niedrigere Qualität';
            }
          });
        }
      });

      peer.on('error', err => {
        console.error('❌ Peer-Fehler:', err);
        statusEl.textContent = 'Peer-Fehler: ' + err.message;
      });
      
    } catch (err) {
      console.error('❌ Verbindungsfehler:', err);
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
