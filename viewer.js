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
    const safeType = String(type || 'info');
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
    // AGGRESSIVERE INTERNET-KONFIGURATION mit zuverlässigen TURN-Servern
    const peer = new Peer({
      config: {
        'iceServers': [
          // Google's STUN Server (für lokale IP-Erkennung)
          { urls: 'stun:stun.l.google.com:19302' },
          
          // ExpressTurn TURN Server
          {
            urls: ['turn:relay1.expressturn.com:3480'],
            username: '00000000207238510З',
            credential: 'g44rhlphv1e7sLBeOJAUob8558Q='
          },
          
          // openrelay.metered.ca (bessere IPv4/IPv6-Unterstützung)
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:80?transport=tcp',
              'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        
        // AGGRESSIVERE ICE-Konfiguration für Internet
        'iceCandidatePoolSize': 50, // Mehr Candidates sammeln
        'bundlePolicy': 'max-bundle',
        'rtcpMuxPolicy': 'require',
        
        // FORCIERE TURN-Server (nur Relay, kein direktes P2P)
        // 'iceTransportPolicy': 'relay', // NUR über TURN-Server
        
        // TESTE: Erlaube auch direkte Verbindungen
        'iceTransportPolicy': 'all', // Versuche alle Verbindungsarten
        
        // Moderne WebRTC-Konfiguration
        'sdpSemantics': 'unified-plan',
        
        // Zusätzliche Optionen für problematische Netzwerke
        'continualGatheringPolicy': 'gather_continually'
      },
      
      // PeerJS-spezifische Optionen
      debug: 1 // Mehr Debug-Ausgabe
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
      debugLog('📋 Call Details: ' + JSON.stringify({peer: call?.peer, type: call?.type}));
      
      // 💬 DATA CHANNEL für Text-Nachrichten einrichten
      let dataChannel = null;
      
      if (call.peerConnection) {
        // Empfänger-Seite: warte auf DataChannel vom Sender
        call.peerConnection.addEventListener('datachannel', (event) => {
          dataChannel = event.channel;
          debugLog('📨 DataChannel empfangen vom Handy!');
          
          dataChannel.addEventListener('open', () => {
            debugLog('✅ DataChannel ist geöffnet - kann Nachrichten senden!');
            // Test-Nachricht an Handy senden
            dataChannel.send('🖥️ Hallo vom Viewer! DataChannel funktioniert! 👋');
          });
          
          dataChannel.addEventListener('message', (event) => {
            debugLog(`💬 Nachricht vom Handy: "${event.data}"`);
            // Antwort zurücksenden
            if (dataChannel.readyState === 'open') {
              dataChannel.send(`🖥️ Viewer hat empfangen: "${event.data}"`);
            }
          });
          
          dataChannel.addEventListener('error', (error) => {
            debugLog(`❌ DataChannel Fehler: ${error}`, 'error');
          });
          
          dataChannel.addEventListener('close', () => {
            debugLog('📪 DataChannel geschlossen');
          });
        });
      }
      
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
          
          // SOFORTIGE State-Abfrage
          debugLog(`🔍 Initial ICE Connection State: ${call.peerConnection.iceConnectionState}`);
          debugLog(`🔍 Initial Connection State: ${call.peerConnection.connectionState}`);
          debugLog(`🔍 Initial Signaling State: ${call.peerConnection.signalingState}`);
          
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
              debugLog(`🔍 ICE Connection State nach Gathering: ${call.peerConnection.iceConnectionState}`);
              debugLog(`🔍 Connection State nach Gathering: ${call.peerConnection.connectionState}`);
              
              // FORCE einen State-Check nach ICE Gathering
              setTimeout(() => {
                debugLog(`🔍 5s nach ICE Gathering - ICE State: ${call.peerConnection.iceConnectionState}`);
                debugLog(`🔍 5s nach ICE Gathering - Conn State: ${call.peerConnection.connectionState}`);
              }, 5000);
            }
          });
          
          call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            const connState = call.peerConnection.connectionState;
            debugLog(`🧊 ICE Connection State: ${state} | Connection State: ${connState}`);
            
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
            } else if (state === 'checking') {
              debugLog('🔍 ICE-Verbindung wird getestet...');
              statusEl.textContent = 'Status: teste Verbindung 🔍';
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
        
        // Stream-Details loggen
        stream.getVideoTracks().forEach((track, i) => {
          const settings = track.getSettings();
          debugLog(`📹 Video Track ${i}: ${settings.width || 'auto'}x${settings.height || 'auto'}@${settings.frameRate || 'auto'}fps`);
          debugLog(`📹 Video Track ${i} State: ${track.readyState}`);
          debugLog(`📹 Video Track ${i} Settings: ${JSON.stringify(settings)}`);
        });
        
        remoteVideo.srcObject = stream;
        statusEl.textContent = 'Status: verbunden ✅';
        debugLog('✅ Stream erfolgreich dem Video-Element zugewiesen');
        
        // Starte WebRTC Stats Monitoring für Empfänger
        if (call.peerConnection) {
          startViewerStatsMonitoring(call.peerConnection);
        }
        
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
  
  // WebRTC Stats Monitoring für Viewer (Empfänger)
  let viewerStatsInterval = null;
  
  function startViewerStatsMonitoring(peerConnection) {
    debugLog('📊 Starte Viewer Stats Monitoring...');
    
    viewerStatsInterval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats();
        let videoStats = null;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            videoStats = report;
          }
        });
        
        if (videoStats) {
          debugLog('═══ VIEWER WEBRTC VIDEO STATS ═══');
          debugLog(`📥 Bytes received: ${(videoStats.bytesReceived / 1024 / 1024).toFixed(2)} MB`);
          debugLog(`📦 Packets received: ${videoStats.packetsReceived}`);
          debugLog(`🎞️ Frames received: ${videoStats.framesReceived}`);
          debugLog(`📏 Frame width: ${videoStats.frameWidth}x${videoStats.frameHeight}`);
          debugLog(`🔧 Decoder: ${videoStats.decoderImplementation || 'unknown'}`);
          debugLog(`📺 Video Element: ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
          
          if (videoStats.packetsLost) {
            debugLog(`⚠️ Packets Lost: ${videoStats.packetsLost}`, 'warn');
          }
          
          if (videoStats.jitter) {
            debugLog(`📊 Jitter: ${(videoStats.jitter * 1000).toFixed(2)}ms`);
          }
        }
      } catch (err) {
        debugLog(`❌ Stats Error: ${err.message}`, 'error');
      }
    }, 3000); // Alle 3 Sekunden
  }
  
  function stopViewerStatsMonitoring() {
    if (viewerStatsInterval) {
      clearInterval(viewerStatsInterval);
      viewerStatsInterval = null;
      debugLog('📊 Viewer Stats Monitoring gestoppt');
    }
  }
}
