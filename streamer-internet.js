export function initInternetStreamerApp() {
  console.log('🌐 Internet-optimierter Streamer (niedrige Bandbreite)');
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
  let peer;

  // 🌐 INTERNET-OPTIMIERTE Video-Einstellungen (niedrige Bandbreite)
  const INTERNET_VIDEO_CONFIG = {
    // Reduzierte Auflösung für TURN-Server
    width: { ideal: 1280, max: 1920 },     // Maximal Full HD
    height: { ideal: 720, max: 1080 },     // Maximal 1080p
    frameRate: { ideal: 25, max: 30 },     // Niedrigere Framerate
    
    // Bandbreite-optimierte Einstellungen
    advanced: [
      { width: { ideal: 1280 } },
      { height: { ideal: 720 } },
      { frameRate: { ideal: 25 } }
    ]
  };

  const INTERNET_AUDIO_CONFIG = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,      // Niedrigere Sample-Rate
    sampleSize: 16,
    channelCount: 1         // Mono für weniger Bandbreite
  };

  // Internet-optimierter Peer mit TURN-Server forcieren
  function createInternetPeer() {
    return new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
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
        iceCandidatePoolSize: 20,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        // Forciere TURN für Internet-Verbindungen
        iceTransportPolicy: 'relay'
      }
    });
  }

  async function getCam() {
    try {
      console.log('🌐 Lade Internet-optimierte Kamera (niedrige Bandbreite)...');
      statusEl.textContent = 'Lade Internet-optimierte Kamera...';
      
      // Automatische Kamera-Wahl (Rückkamera bevorzugt)
      const videoConstraints = {
        ...INTERNET_VIDEO_CONFIG,
        facingMode: { ideal: 'environment' } // Rückkamera bevorzugt
      };

      localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: INTERNET_AUDIO_CONFIG
      });

      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];
      const videoSettings = videoTrack.getSettings();
      const audioSettings = audioTrack.getSettings();
      
      console.log('🌐 Internet-Stream konfiguriert:');
      console.log(`📹 Video: ${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps`);
      console.log(`🔊 Audio: ${audioSettings.sampleRate}Hz, ${audioSettings.channelCount} Kanäle`);
      
      localVideo.srcObject = localStream;
      statusEl.textContent = `Kamera bereit: ${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps (Internet-optimiert)`;
      
      createPeerAndConnect();
      
    } catch (err) {
      console.error('❌ Internet-Kamera Fehler:', err);
      statusEl.textContent = 'Kamera-Fehler: ' + err.message;
      
      // Fallback mit noch niedrigerer Qualität
      try {
        console.log('🔄 Fallback zu minimaler Qualität für Internet...');
        
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 25 },
            facingMode: { ideal: 'environment' }
          },
          audio: {
            ...INTERNET_AUDIO_CONFIG,
            sampleRate: 22050 // Noch niedriger für schwache Verbindungen
          }
        });
        
        localVideo.srcObject = localStream;
        const settings = localStream.getVideoTracks()[0].getSettings();
        statusEl.textContent = `Fallback-Kamera: ${settings.width}x${settings.height}@${settings.frameRate}fps (Minimal für Internet)`;
        
        createPeerAndConnect();
        
      } catch (fallbackErr) {
        console.error('❌ Auch Fallback fehlgeschlagen:', fallbackErr);
        statusEl.textContent = 'Kamera nicht verfügbar: ' + fallbackErr.message;
      }
    }
  }

  function createPeerAndConnect() {
    if (!viewerId) {
      statusEl.textContent = 'Fehler: Viewer-ID fehlt in URL';
      return;
    }

    console.log('🌐 Erstelle Internet-Peer mit TURN-Server...');
    statusEl.textContent = 'Verbinde über TURN-Server...';
    
    peer = createInternetPeer();

    peer.on('open', id => {
      console.log('✅ Internet-Peer verbunden:', id);
      statusEl.textContent = 'Peer verbunden - starte Internet-Stream...';
      
      // Stream mit Internet-optimierten Einstellungen senden
      const call = peer.call(viewerId, localStream, {
        // Bandwidth-Beschränkungen für TURN-Server
        bandwidth: {
          video: 1000000, // 1 Mbps Video (niedrig für TURN)
          audio: 64000    // 64 kbps Audio
        }
      });
      
      call.on('stream', remoteStream => {
        console.log('📺 Remote-Stream empfangen (ungewöhnlich für Streamer)');
      });

      call.on('close', () => {
        console.log('📴 Internet-Call beendet');
        statusEl.textContent = 'Stream beendet';
      });

      call.on('error', err => {
        console.error('❌ Internet-Call Fehler:', err);
        statusEl.textContent = 'Stream-Fehler: ' + err.message;
        
        // Bei TURN-Server Problemen: Retry mit noch niedrigerer Qualität
        if (err.message.includes('bandwidth') || err.message.includes('network')) {
          statusEl.textContent = 'TURN-Server überlastet - versuche niedrigere Qualität...';
          retryWithLowerQuality();
        }
      });

      // ICE Connection State überwachen
      call.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const state = call.peerConnection.iceConnectionState;
        console.log('🧊 Internet ICE State:', state);
        
        switch (state) {
          case 'connected':
            statusEl.textContent = '✅ Internet-Stream läuft über TURN-Server!';
            break;
          case 'disconnected':
            statusEl.textContent = '⚠️ Internet-Verbindung unterbrochen...';
            break;
          case 'failed':
            statusEl.textContent = '❌ Internet-Stream fehlgeschlagen - TURN-Server Problem';
            if (reconnectAttempts < maxReconnectAttempts) {
              setTimeout(retryConnection, 3000);
            }
            break;
        }
      });
    });

    peer.on('error', err => {
      console.error('❌ Internet-Peer Fehler:', err);
      statusEl.textContent = 'Internet-Peer Fehler: ' + err.message;
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(retryConnection, 2000);
      }
    });
  }

  function retryWithLowerQuality() {
    console.log('🔄 Retry mit minimaler Qualität für Internet...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Minimal-Konfiguration für schwache TURN-Server
    navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 480, max: 640 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 10, max: 15 }, // Sehr niedrige Framerate
        facingMode: { ideal: 'environment' }
      },
      audio: {
        echoCancellation: true,
        sampleRate: 16000, // Sehr niedrig
        channelCount: 1
      }
    }).then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      
      const settings = stream.getVideoTracks()[0].getSettings();
      statusEl.textContent = `Ultra-Low-Quality: ${settings.width}x${settings.height}@${settings.frameRate}fps`;
      
      // Neuer Call mit minimaler Qualität
      if (peer && peer.open) {
        const call = peer.call(viewerId, localStream, {
          bandwidth: {
            video: 500000,  // Nur 500 kbps
            audio: 32000    // Nur 32 kbps
          }
        });
      }
    }).catch(err => {
      console.error('❌ Minimal-Quality auch fehlgeschlagen:', err);
      statusEl.textContent = 'Auch minimale Qualität nicht möglich';
    });
  }

  function retryConnection() {
    console.log(`🔄 Internet-Reconnect Versuch ${reconnectAttempts}/${maxReconnectAttempts}`);
    statusEl.textContent = `Reconnect ${reconnectAttempts}/${maxReconnectAttempts}...`;
    
    if (peer) {
      peer.destroy();
    }
    
    setTimeout(createPeerAndConnect, 1000);
  }

  // Auto-Start
  if (viewerId) {
    getCam();
  } else {
    statusEl.textContent = 'Fehler: Viewer-ID fehlt in URL (?id=...)';
  }
}
