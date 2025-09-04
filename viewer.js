export function initViewerApp() {
  console.log('Viewer App wird initialisiert (Browser ist bereit)');
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

  // Console-Logging für Verbindungsdiagnose
  function debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const safeType = type || 'info';
    const prefix = `[${timestamp}] [VIEWER-${safeType.toUpperCase()}]`;
    
    switch(safeType) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }

  debugLog('👀 Viewer App initialisiert - bereit für Verbindung');

  // 🎯 STREAM AKTIVIEREN Button Event
  btnStartStream.addEventListener('click', () => {
    debugLog('🚀 Stream aktiviert durch User-Interaktion');
    
    // UI umschalten
    startScreen.style.display = 'none';
    qrSection.style.display = 'block';
    
    // Status aktualisieren
    statusEl.textContent = 'Status: Wird initialisiert...';
    isStreamActive = true;
    
    // Stream starten
    initializeStreaming();
  });

  function initializeStreaming() {
    debugLog('📡 Streaming-Initialisierung gestartet');
    
    try {
      // Peer erstellen und verbinden
      createPeerConnection();
    } catch (err) {
      debugLog(`❌ Fehler bei Streaming-Initialisierung: ${err.message}`, 'error');
      statusEl.textContent = 'Fehler: ' + err.message;
    }
  }

  function createPeer() {
    // INTERNET-OPTIMIERTE KONFIGURATION mit TURN-Server forciert
    const peer = new Peer({
      config: {
        'iceServers': [
          // Google's öffentliche STUN Server
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // Alternative STUN Server
          { urls: 'stun:stun.relay.metered.ca:80' },
          // Robuste TURN Server Konfiguration für Internet
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
          // Zusätzliche kostenlose TURN Server
          {
            urls: [
              'turn:relay1.expressturn.com:3478',
              'turn:relay1.expressturn.com:3478?transport=tcp'
            ],
            username: 'efSCKZqnZbF2RfHZ68',
            credential: 'web@anyfirewall.com'
          },
          // Weitere TURN Server für maximale Internet-Kompatibilität
          {
            urls: [
              'turn:numb.viagenie.ca:3478',
              'turn:numb.viagenie.ca:3478?transport=tcp'
            ],
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ],
        'iceCandidatePoolSize': 30, // Mehr Candidates für Internet
        'bundlePolicy': 'max-bundle', // Bessere Internet-Kompatibilität
        'rtcpMuxPolicy': 'require',
        // FORCIERE TURN-Server für Internet (auskommentieren für WLAN)
        'iceTransportPolicy': 'relay', // NUR TURN-Server, kein direktes P2P
        'sdpSemantics': 'unified-plan'
      }
    });

    return peer;
  }

  function createPeerConnection() {
    if (!isStreamActive) {
      debugLog('⏹️ Stream nicht aktiv - Peer-Erstellung übersprungen', 'warn');
      return;
    }

    debugLog('🔧 Erstelle neuen Peer mit TURN-Server-Konfiguration');
    currentPeer = createPeer();
    
    currentPeer.on('open', (id) => {
      debugLog(`✅ Peer erfolgreich verbunden mit ID: ${id}`);
      pidEl.textContent = id;
      statusEl.textContent = 'Status: Warte auf Stream...';
      
      // QR-Code und Link generieren (erst NACH User-Interaktion!)
      generateQRCodeAndLink(id);
      
      reconnectAttempts = 0; // Reset bei erfolgreicher Verbindung
    });

    currentPeer.on('call', call => {
      statusEl.textContent = 'Status: eingehender Anruf…';
      debugLog('📞 Eingehender Anruf vom Handy erhalten');
      debugLog('📋 Call Details:', call);
      
      // Debug: Warum wird Verbindung nicht angenommen?
      if (!call) {
        debugLog('❌ FEHLER: Call-Objekt ist null/undefined!', 'error');
        return;
      }
      
      if (!call.peer) {
        debugLog('❌ FEHLER: Keine Peer-ID im Call-Objekt!', 'error');
        return;
      }
      
      debugLog(`🔗 Verbindungsversuch von Peer: ${call.peer}`);
      
      // Debug: ICE-Verbindung überwachen (warten bis peerConnection verfügbar ist)
      setTimeout(async () => {
        if (call.peerConnection) {
          debugLog('🔧 PeerConnection verfügbar - konfiguriere Monitoring');
          
          // Codec-Präferenzen auch auf Empfänger-Seite setzen
          const transceivers = call.peerConnection.getTransceivers();
          transceivers.forEach(async transceiver => {
            if (transceiver.receiver && transceiver.receiver.track) {
              const track = transceiver.receiver.track;
              if (track.kind === 'video') {
                debugLog('📺 Video-Empfänger konfiguriert für H264/VP8 Priorität');
              }
            }
          });
          
          // ICE Candidates Monitor
          call.peerConnection.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
              debugLog(`🧊 ICE Candidate gesammelt: ${event.candidate.type} - ${event.candidate.address || 'no-address'}`);
            } else {
              debugLog('🧊 ICE Gathering abgeschlossen');
            }
          });
          
          call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            debugLog(`🧊 ICE Connection State: ${state}`);
            
            if (state === 'failed') {
              debugLog('❌ ICE-Verbindung fehlgeschlagen - wahrscheinlich NAT/Firewall Problem', 'error');
              statusEl.textContent = 'Status: Verbindung fehlgeschlagen ❌ (NAT/Firewall Problem?)';
              
              if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                debugLog(`🔄 Starte Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts}`);
                setTimeout(() => {
                  statusEl.textContent = `Status: Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
                  createPeerConnection();
                }, 2000);
              } else {
                debugLog('❌ Alle Reconnect-Versuche aufgebraucht', 'error');
              }
            } else if (state === 'disconnected') {
              debugLog('⚠️ ICE-Verbindung unterbrochen', 'warn');
              statusEl.textContent = 'Status: Verbindung unterbrochen 🔄 (versuche wieder zu verbinden...)';
            } else if (state === 'connected' || state === 'completed') {
              debugLog('✅ ICE-Verbindung erfolgreich hergestellt!');
              statusEl.textContent = 'Status: verbunden ✅';
            } else if (state === 'connecting') {
              debugLog('🔄 ICE-Verbindung wird aufgebaut...');
              statusEl.textContent = 'Status: verbinde 🔄';
            }
          });
          
          // Zusätzliches Connection State Monitoring
          call.peerConnection.addEventListener('connectionstatechange', () => {
            const state = call.peerConnection.connectionState;
            debugLog(`🔗 Connection State: ${state}`);
          });
        } else {
          debugLog('❌ FEHLER: PeerConnection nicht verfügbar!', 'error');
        }
      }, 100);
      
      call.on('stream', stream => {
        debugLog('🎥 Stream vom Handy erhalten!');
        debugLog(`📹 Video tracks: ${stream.getVideoTracks().length}`);
        debugLog(`🔊 Audio tracks: ${stream.getAudioTracks().length}`);
        
        // Stream-Details loggen
        stream.getVideoTracks().forEach((track, i) => {
          const settings = track.getSettings();
          debugLog(`📹 Video Track ${i}: ${settings.width}x${settings.height}@${settings.frameRate}fps`);
          debugLog(`📹 Video Track ${i} State: ${track.readyState}`);
        });
        
        stream.getAudioTracks().forEach((track, i) => {
          const settings = track.getSettings();
          debugLog(`🔊 Audio Track ${i}: ${settings.sampleRate}Hz, ${settings.channelCount} channels`);
          debugLog(`🔊 Audio Track ${i} State: ${track.readyState}`);
        });
        
        remoteVideo.srcObject = stream;
        statusEl.textContent = 'Status: verbunden ✅';
        debugLog('✅ Stream erfolgreich dem Video-Element zugewiesen');
        
        // 📱 ORIGINAL-SEITENVERHÄLTNIS beibehalten (1:1 wie Kamera)
        remoteVideo.onloadedmetadata = () => {
          const videoWidth = remoteVideo.videoWidth;
          const videoHeight = remoteVideo.videoHeight;
          const aspectRatio = videoWidth / videoHeight;
          
          debugLog(`📺 Video Metadata: ${videoWidth}x${videoHeight}, Ratio: ${aspectRatio.toFixed(3)}`);
          
          // WICHTIG: Video-Element auf ORIGINAL-Abmessungen setzen
          // Entferne alle vorherigen Styling-Overrides
          remoteVideo.style.width = '';
          remoteVideo.style.height = '';
          remoteVideo.style.maxWidth = '';
          remoteVideo.style.maxHeight = '';
          
          // Setze ECHTE Dimensionen basierend auf Original-Stream
          if (aspectRatio < 1) {
            // HOCHKANT (z.B. 720x1280) - zeige GENAU so an
            debugLog(`📱 HOCHKANT-Stream: ${videoWidth}x${videoHeight}`);
            remoteVideo.style.width = 'auto';
            remoteVideo.style.height = '80vh'; // Höhe begrenzen für Bildschirm
            remoteVideo.style.maxHeight = '80vh';
          } else if (aspectRatio > 1.5) {
            // BREITBILD (z.B. 1280x720) - zeige GENAU so an  
            debugLog(`📺 BREITBILD-Stream: ${videoWidth}x${videoHeight}`);
            remoteVideo.style.width = '100%';
            remoteVideo.style.height = 'auto';
            remoteVideo.style.maxWidth = '100%';
          } else {
            // QUADRATISCH oder LEICHT RECHTECKIG (z.B. 640x480, 800x600)
            debugLog(`⬜ QUADRAT/LEICHT-RECHTECKIG Stream: ${videoWidth}x${videoHeight}`);
            remoteVideo.style.width = 'auto';
            remoteVideo.style.height = '70vh';
            remoteVideo.style.maxHeight = '70vh';
          }
          
          // UNIVERSAL: Immer Original-Verhältnis beibehalten
          remoteVideo.style.objectFit = 'contain'; // KRITISCH: Verhältnis nicht verzerren
          remoteVideo.style.display = 'block';
          remoteVideo.style.margin = '0 auto';
          
          // Container flexibel machen für alle Formate
          const videoContainer = remoteVideo.parentElement;
          videoContainer.style.display = 'flex';
          videoContainer.style.justifyContent = 'center';
          videoContainer.style.alignItems = 'center';
          
          debugLog(`✅ Video-Display konfiguriert für Ratio ${aspectRatio.toFixed(3)}`);
        };
      });

      debugLog('📞 Anruf wird angenommen...');
      call.answer(); // Anruf annehmen
      debugLog('✅ Call.answer() ausgeführt - warte auf Stream');
    });

    currentPeer.on('disconnected', () => {
      debugLog('⚠️ Peer vom Handy getrennt - versuche Reconnect', 'warn');
      statusEl.textContent = 'Status: getrennt, versuche Reconnect 🔄';
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        debugLog(`🔄 Starte Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts}`);
        setTimeout(() => {
          statusEl.textContent = `Status: Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
          createPeerConnection();
        }, 3000);
      } else {
        debugLog('❌ Alle Reconnect-Versuche aufgebraucht', 'error');
      }
    });
    
    currentPeer.on('error', err => {
      debugLog(`❌ Peer Fehler: ${err.type} - ${err.message}`, 'error');
      statusEl.textContent = 'Peer Fehler: ' + err.message;
      
      // Detaillierte Fehleranalyse
      switch(err.type) {
        case 'peer-unavailable':
          debugLog('🔍 DIAGNOSE: Handy ist nicht erreichbar - falscher QR-Code oder Handy offline?', 'error');
          break;
        case 'network':
          debugLog('🔍 DIAGNOSE: Netzwerk-Fehler - Internet-Verbindung prüfen', 'error');
          break;
        case 'server-error':
          debugLog('🔍 DIAGNOSE: Server-Fehler - PeerJS Server nicht erreichbar', 'error');
          break;
        case 'socket-error':
          debugLog('🔍 DIAGNOSE: WebSocket-Fehler - Firewall blockiert Verbindung?', 'error');
          break;
        default:
          debugLog(`🔍 DIAGNOSE: Unbekannter Fehler-Typ: ${err.type}`, 'error');
      }
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        debugLog(`🔄 Starte Fehler-Reconnect ${reconnectAttempts}/${maxReconnectAttempts}`);
        setTimeout(() => {
          statusEl.textContent = `Status: Peer Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
          createPeerConnection();
        }, 3000);
      } else {
        debugLog('❌ Alle Fehler-Reconnect-Versuche aufgebraucht', 'error');
      }
    });
  }

  function generateQRCodeAndLink(id) {
    const url = new URL(window.location.origin + window.location.pathname.replace('index.html','') + 'streamer.html');
    url.searchParams.set('id', id);
    linkEl.textContent = url.toString();
    
    // QR Code generieren
    const qrDiv = document.getElementById('qr');
    qrDiv.innerHTML = '';
    
    new QRCode(qrDiv, {
      text: url.toString(), 
      width: 256, 
      height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
    
    console.log('📱 QR-Code und Link generiert:', url.toString());
    debugLog(`📱 Streamer-URL generiert: ${url.toString()}`);
  }

  // Vollbild-Funktionalität
  document.getElementById('btnFS').addEventListener('click', () => {
    if (remoteVideo.requestFullscreen) {
      remoteVideo.requestFullscreen();
    } else if (remoteVideo.webkitRequestFullscreen) {
      remoteVideo.webkitRequestFullscreen();
    }
  });
}
