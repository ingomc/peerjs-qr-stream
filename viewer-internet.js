export function initInternetOptimizedViewer() {
  console.log('🌐 Internet-Optimized Viewer wird initialisiert');
  const remoteVideo = document.getElementById('remote');
  const statusEl = document.getElementById('status');
  const pidEl = document.getElementById('pid');
  const linkEl = document.getElementById('link');
  const btnStartStream = document.getElementById('btnStartStream');
  const startScreen = document.getElementById('startScreen');
  const qrSection = document.getElementById('qrSection');

  let currentPeer = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let isStreamActive = false;
  let connectionTimeout = null;

  // AGGRESSIVE Internet-Konfiguration mit mehreren TURN-Servern
  function createInternetOptimizedPeer() {
    console.log('🔧 Erstelle Peer mit Internet-Optimierung (TURN-Server forciert)');
    
    const peer = new Peer({
      // Standard PeerJS Server
      host: 'peerjs-server.herokuapp.com',
      port: 443,
      path: '/',
      secure: true,
      
      config: {
        'iceServers': [
          // Minimal STUN (nur für lokale IP-Erkennung)
          { urls: 'stun:stun.l.google.com:19302' },
          
          // HAUPTSÄCHLICH TURN-Server für Internet-Verbindungen
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:80?transport=tcp',
              'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          
          // ExpressTurn - sehr zuverlässig für Internet
          {
            urls: [
              'turn:relay1.expressturn.com:3478',
              'turn:relay1.expressturn.com:3478?transport=tcp',
              'turn:relay1.expressturn.com:80',
              'turn:relay1.expressturn.com:443',
              'turn:relay1.expressturn.com:80?transport=tcp',
              'turn:relay1.expressturn.com:443?transport=tcp'
            ],
            username: 'efSCKZqnZbF2RfHZ68',
            credential: 'web@anyfirewall.com'
          },
          
          // Zusätzliche TURN Server
          {
            urls: [
              'turn:numb.viagenie.ca:3478',
              'turn:numb.viagenie.ca:3478?transport=tcp'
            ],
            username: 'webrtc@live.com',
            credential: 'muazkh'
          },
          
          // Weitere TURN Server für maximale Internet-Kompatibilität
          {
            urls: [
              'turn:turn.anyfirewall.com:443?transport=tcp',
              'turn:relay.backups.cz:3478',
              'turn:relay.backups.cz:3478?transport=tcp'
            ],
            username: 'webrtc',
            credential: 'webrtc'
          }
        ],
        
        // AGGRESSIVE Einstellungen für Internet-Verbindungen
        'iceCandidatePoolSize': 50, // Sehr viele Candidates
        'bundlePolicy': 'max-bundle',
        'rtcpMuxPolicy': 'require',
        'sdpSemantics': 'unified-plan',
        
        // FORCIERE TURN-Server für Internet
        'iceTransportPolicy': 'relay', // NUR TURN, kein Direct P2P!
        'enableDtlsSrtp': true
      }
    });

    return peer;
  }

  // Alternative Konfiguration mit fallback auf "all"
  function createFallbackPeer() {
    console.log('🔄 Erstelle Fallback-Peer mit weniger aggressiven Einstellungen');
    
    const peer = new Peer({
      config: {
        'iceServers': [
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
        'iceCandidatePoolSize': 30,
        'bundlePolicy': 'max-bundle',
        'rtcpMuxPolicy': 'require',
        'iceTransportPolicy': 'all', // Erlaube Direct P2P als Fallback
        'enableDtlsSrtp': true
      }
    });

    return peer;
  }

  // 🎯 STREAM AKTIVIEREN Button Event
  btnStartStream?.addEventListener('click', () => {
    console.log('🚀 Internet-Stream wird durch User-Interaktion aktiviert');
    
    if (startScreen) startScreen.style.display = 'none';
    if (qrSection) qrSection.style.display = 'block';
    
    statusEl.textContent = 'Status: Internet-Verbindung wird aufgebaut (TURN-Server)...';
    isStreamActive = true;
    
    initializeInternetStreaming();
  });

  function initializeInternetStreaming() {
    console.log('🌐 Internet-Streaming-Initialisierung gestartet');
    
    try {
      // Längerer Timeout für Internet-Verbindungen
      connectionTimeout = setTimeout(() => {
        console.log('⏰ Internet-Verbindungs-Timeout - versuche Fallback');
        handleConnectionTimeout();
      }, 25000); // 25 Sekunden für Internet
      
      createPeerConnection(true); // Aggressive Konfiguration zuerst
    } catch (err) {
      console.error('❌ Fehler bei Internet-Streaming-Initialisierung:', err);
      statusEl.textContent = 'Fehler: ' + err.message;
    }
  }

  function createPeerConnection(useAggressive = true) {
    if (!isStreamActive) {
      console.log('⏹️ Stream nicht aktiv - Peer-Erstellung übersprungen');
      return;
    }

    // Alte Verbindung aufräumen
    if (currentPeer) {
      currentPeer.destroy();
    }

    // Wähle Konfiguration basierend auf Versuch
    currentPeer = useAggressive ? createInternetOptimizedPeer() : createFallbackPeer();
    
    currentPeer.on('open', (id) => {
      console.log('✅ Internet-Peer verbunden mit ID:', id);
      clearTimeout(connectionTimeout);
      pidEl.textContent = id;
      statusEl.textContent = 'Status: Warte auf Internet-Stream... (TURN-Server bereit)';
      
      generateQRCodeAndLink(id);
      reconnectAttempts = 0;
    });

    currentPeer.on('call', (call) => {
      console.log('📞 Eingehender Internet-Call empfangen');
      statusEl.textContent = 'Status: Internet-Stream wird über TURN-Server aufgebaut...';
      
      call.answer();
      
      call.on('stream', (remoteStream) => {
        console.log('📺 Internet-Stream erhalten! TURN-Server Verbindung erfolgreich');
        statusEl.textContent = 'Status: Internet-Stream läuft über TURN-Server! ✅';
        
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play().catch(err => {
          console.error('Video-Wiedergabe-Fehler:', err);
        });
        
        // ICE Connection State überwachen
        if (call.peerConnection) {
          call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            console.log('🧊 ICE Connection State:', call.peerConnection.iceConnectionState);
            
            if (call.peerConnection.iceConnectionState === 'connected') {
              statusEl.textContent = 'Status: Internet-Stream erfolgreich verbunden! ✅';
            } else if (call.peerConnection.iceConnectionState === 'disconnected') {
              statusEl.textContent = 'Status: Internet-Verbindung unterbrochen - Reconnect...';
            } else if (call.peerConnection.iceConnectionState === 'failed') {
              statusEl.textContent = 'Status: Internet-Verbindung fehlgeschlagen - Retry...';
              if (reconnectAttempts < maxReconnectAttempts) {
                setTimeout(() => retryConnection(false), 3000); // Fallback-Modus
              }
            }
          });
        }
      });

      call.on('close', () => {
        console.log('📴 Internet-Call beendet');
        statusEl.textContent = 'Status: Internet-Stream beendet';
        remoteVideo.srcObject = null;
      });

      call.on('error', (err) => {
        console.error('❌ Internet-Call-Fehler:', err);
        statusEl.textContent = 'Internet-Stream-Fehler: ' + err.message;
        
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => retryConnection(false), 3000);
        }
      });
    });

    currentPeer.on('error', (err) => {
      console.error('❌ Internet-Peer-Fehler:', err);
      
      if (err.type === 'network' || err.type === 'server-error') {
        statusEl.textContent = `Internet-Netzwerk-Problem: Versuche Fallback-TURN-Server...`;
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => retryConnection(false), 2000);
        } else {
          statusEl.textContent = 'Internet-Verbindung nicht möglich. TURN-Server blockiert!';
        }
      } else {
        statusEl.textContent = 'Internet-Peer-Fehler: ' + err.message;
      }
    });

    currentPeer.on('disconnected', () => {
      console.log('🔌 Internet-Peer getrennt - Reconnect versuchen');
      statusEl.textContent = 'Internet-Verbindung unterbrochen - Reconnect...';
      
      if (reconnectAttempts < maxReconnectAttempts && isStreamActive) {
        setTimeout(() => retryConnection(false), 1000);
      }
    });
  }

  function handleConnectionTimeout() {
    console.log('⏰ Internet-Verbindung dauert zu lange - Fallback-Modus');
    statusEl.textContent = 'TURN-Server-Verbindung dauert zu lange - versuche Fallback...';
    
    if (reconnectAttempts < maxReconnectAttempts) {
      retryConnection(false); // Weniger aggressive Konfiguration
    } else {
      statusEl.textContent = 'Internet-Verbindung nicht möglich. Beide Geräte hinter zu strikten Firewalls!';
    }
  }

  function retryConnection(useAggressive = false) {
    reconnectAttempts++;
    console.log(`🔄 Internet-Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} (${useAggressive ? 'Aggressive' : 'Fallback'} Mode)`);
    statusEl.textContent = `Internet-Reconnect ${reconnectAttempts}/${maxReconnectAttempts}...`;
    
    setTimeout(() => {
      if (isStreamActive) {
        createPeerConnection(useAggressive);
      }
    }, 1000);
  }

  function generateQRCodeAndLink(peerId) {
    const baseUrl = window.location.origin + window.location.pathname.replace('/viewer-internet.html', '');
    const streamerUrl = `${baseUrl}/streamer.html?id=${peerId}`;
    
    console.log('🔗 Internet-QR-Code und Link generiert:', streamerUrl);
    
    linkEl.textContent = streamerUrl;
    linkEl.href = streamerUrl;
    
    const qrCodeContainer = document.getElementById('qrcode');
    if (qrCodeContainer && typeof QRCode !== 'undefined') {
      qrCodeContainer.innerHTML = '';
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

  // Debug-Informationen für Internet-Verbindungen
  console.log('🌐 Internet-Optimized-Viewer bereit');
  console.log('📊 Browser:', navigator.userAgent);
  console.log('🌐 Location:', window.location.href);
  console.log('⚡ TURN-Server werden forciert für Internet-Kompatibilität');

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
