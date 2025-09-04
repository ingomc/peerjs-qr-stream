export function initHomeNetworkViewer() {
  console.log('🏠 Home Network Optimized Viewer wird initialisiert');
  const remoteVideo = document.getElementById('remote');
  const statusEl = document.getElementById('status');
  const pidEl = document.getElementById('pid');
  const linkEl = document.getElementById('link');
  const btnStartStream = document.getElementById('btnStartStream');
  const startScreen = document.getElementById('startScreen');
  const qrSection = document.getElementById('qrSection');

  let currentPeer = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let isStreamActive = false;
  let connectionTimeout = null;

  // Heimnetzwerk-optimierte Konfiguration
  function createPeerWithHomeNetworkOptimization() {
    console.log('🔧 Erstelle Peer mit Heimnetzwerk-Optimierung');
    
    const peer = new Peer({
      // PeerJS Server Optionen für Heimnetzwerke
      host: 'peerjs-server.herokuapp.com',
      port: 443,
      path: '/',
      secure: true,
      
      config: {
        'iceServers': [
          // Basis STUN Server (sollten auch hinter Router funktionieren)
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          
          // Heimnetzwerk-freundliche TURN Server (Port 80/443)
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          
          // Alternative TURN Server für Router-Kompatibilität
          {
            urls: [
              'turn:relay1.expressturn.com:3478',
              'turn:relay1.expressturn.com:3478?transport=tcp',
              'turn:relay1.expressturn.com:80',
              'turn:relay1.expressturn.com:443'
            ],
            username: 'efSCKZqnZbF2RfHZ68',
            credential: 'web@anyfirewall.com'
          },
          
          // Backup TURN Server
          {
            urls: [
              'turn:numb.viagenie.ca:3478',
              'turn:numb.viagenie.ca:3478?transport=tcp'
            ],
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ],
        
        // Heimnetzwerk-optimierte RTC-Einstellungen
        'iceCandidatePoolSize': 20,
        'bundlePolicy': 'max-bundle',
        'rtcpMuxPolicy': 'require',
        'sdpSemantics': 'unified-plan',
        
        // Aggressive ICE-Sammlung für NAT-Router
        'iceTransportPolicy': 'all',
        'enableDtlsSrtp': true
      }
    });

    return peer;
  }

  // 🎯 STREAM AKTIVIEREN Button Event
  btnStartStream?.addEventListener('click', () => {
    console.log('🚀 Home Network Stream wird durch User-Interaktion aktiviert');
    
    // UI umschalten
    if (startScreen) startScreen.style.display = 'none';
    if (qrSection) qrSection.style.display = 'block';
    
    // Status aktualisieren
    statusEl.textContent = 'Status: Heimnetzwerk-Optimierung wird geladen...';
    isStreamActive = true;
    
    // Stream mit erweiterten Retry-Mechanismus starten
    initializeHomeNetworkStreaming();
  });

  function initializeHomeNetworkStreaming() {
    console.log('🏠 Heimnetzwerk-Streaming-Initialisierung gestartet');
    
    try {
      // Verbindungs-Timeout für Heimnetzwerke
      connectionTimeout = setTimeout(() => {
        console.log('⏰ Verbindungs-Timeout - versuche Reconnect');
        handleConnectionTimeout();
      }, 15000); // 15 Sekunden Timeout
      
      // Peer erstellen
      createPeerConnection();
    } catch (err) {
      console.error('❌ Fehler bei Heimnetzwerk-Streaming-Initialisierung:', err);
      statusEl.textContent = 'Fehler: ' + err.message;
    }
  }

  function createPeerConnection() {
    if (!isStreamActive) {
      console.log('⏹️ Stream nicht aktiv - Peer-Erstellung übersprungen');
      return;
    }

    // Alte Verbindung aufräumen
    if (currentPeer) {
      currentPeer.destroy();
    }

    currentPeer = createPeerWithHomeNetworkOptimization();
    
    // Event Handler für Heimnetzwerke optimiert
    currentPeer.on('open', (id) => {
      console.log('✅ Heimnetzwerk-Peer verbunden mit ID:', id);
      clearTimeout(connectionTimeout);
      pidEl.textContent = id;
      statusEl.textContent = 'Status: Warte auf Stream... (Heimnetzwerk bereit)';
      
      generateQRCodeAndLink(id);
      reconnectAttempts = 0;
    });

    currentPeer.on('call', (call) => {
      console.log('📞 Eingehender Call empfangen (Heimnetzwerk)');
      statusEl.textContent = 'Status: Stream wird aufgebaut...';
      
      // Call annehmen - für Viewer keine eigene Kamera nötig
      call.answer();
      
      call.on('stream', (remoteStream) => {
        console.log('📺 Stream erhalten! Heimnetzwerk-Verbindung erfolgreich');
        statusEl.textContent = 'Status: Stream läuft! ✅';
        
        // Stream zum Video-Element hinzufügen
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play().catch(err => {
          console.error('Video-Wiedergabe-Fehler:', err);
          statusEl.textContent = 'Warnung: Video kann nicht abgespielt werden';
        });
      });

      call.on('close', () => {
        console.log('📴 Call beendet');
        statusEl.textContent = 'Status: Stream beendet';
        remoteVideo.srcObject = null;
      });

      call.on('error', (err) => {
        console.error('❌ Call-Fehler:', err);
        statusEl.textContent = 'Fehler beim Stream: ' + err.message;
        
        // Bei Heimnetzwerk-Fehlern: Retry
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(retryConnection, 3000);
        }
      });
    });

    currentPeer.on('error', (err) => {
      console.error('❌ Heimnetzwerk-Peer-Fehler:', err);
      
      // Spezielle Behandlung für Heimnetzwerk-Probleme
      if (err.type === 'network' || err.type === 'server-error') {
        statusEl.textContent = `Netzwerk-Problem (${err.type}): Versuche Reconnect...`;
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(retryConnection, 2000);
        } else {
          statusEl.textContent = 'Heimnetzwerk-Verbindung fehlgeschlagen. Router-Einstellungen prüfen!';
        }
      } else {
        statusEl.textContent = 'Peer-Fehler: ' + err.message;
      }
    });

    currentPeer.on('disconnected', () => {
      console.log('🔌 Peer getrennt - Heimnetzwerk Reconnect versuchen');
      statusEl.textContent = 'Verbindung unterbrochen - Reconnect...';
      
      if (reconnectAttempts < maxReconnectAttempts && isStreamActive) {
        setTimeout(retryConnection, 1000);
      }
    });
  }

  function handleConnectionTimeout() {
    console.log('⏰ Heimnetzwerk-Verbindung dauert zu lange - Retry');
    statusEl.textContent = 'Verbindung dauert zu lange - versuche erneut...';
    
    if (reconnectAttempts < maxReconnectAttempts) {
      retryConnection();
    } else {
      statusEl.textContent = 'Heimnetzwerk-Verbindung nicht möglich. Router-Konfiguration prüfen!';
    }
  }

  function retryConnection() {
    reconnectAttempts++;
    console.log(`🔄 Heimnetzwerk-Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts}`);
    statusEl.textContent = `Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts}...`;
    
    // Kurze Pause vor Reconnect
    setTimeout(() => {
      if (isStreamActive) {
        createPeerConnection();
      }
    }, 1000);
  }

  function generateQRCodeAndLink(peerId) {
    // Streamer URL generieren
    const baseUrl = window.location.origin + window.location.pathname.replace('/viewer.html', '');
    const streamerUrl = `${baseUrl}/streamer.html?id=${peerId}`;
    
    console.log('🔗 QR-Code und Link generiert:', streamerUrl);
    
    // Link anzeigen
    linkEl.textContent = streamerUrl;
    linkEl.href = streamerUrl;
    
    // QR-Code generieren
    const qrCodeContainer = document.getElementById('qrcode');
    if (qrCodeContainer && typeof QRCode !== 'undefined') {
      qrCodeContainer.innerHTML = ''; // Clear previous QR code
      new QRCode(qrCodeContainer, {
        text: streamerUrl,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }

  // Debug-Informationen für Heimnetzwerke
  console.log('🏠 Heimnetzwerk-Viewer bereit');
  console.log('📊 Browser:', navigator.userAgent);
  console.log('🌐 Location:', window.location.href);
  
  // Heimnetzwerk-spezifische Checks
  if (navigator.connection) {
    console.log('📡 Netzwerk-Info:', navigator.connection);
  }

  return {
    destroy: () => {
      isStreamActive = false;
      clearTimeout(connectionTimeout);
      if (currentPeer) {
        currentPeer.destroy();
      }
    }
  };
}
