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

  // 🎯 STREAM AKTIVIEREN Button Event
  btnStartStream.addEventListener('click', () => {
    console.log('🚀 Stream wird durch User-Interaktion aktiviert (für Autoplay)');
    
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
    console.log('📡 Streaming-Initialisierung gestartet');
    
    try {
      // Peer erstellen und verbinden
      createPeerConnection();
    } catch (err) {
      console.error('❌ Fehler bei Streaming-Initialisierung:', err);
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
      console.log('⏹️ Stream nicht aktiv - Peer-Erstellung übersprungen');
      return;
    }

    currentPeer = createPeer();
    
    currentPeer.on('open', (id) => {
      console.log('✅ Peer verbunden mit ID:', id);
      pidEl.textContent = id;
      statusEl.textContent = 'Status: Warte auf Stream...';
      
      // QR-Code und Link generieren (erst NACH User-Interaktion!)
      generateQRCodeAndLink(id);
      
      reconnectAttempts = 0; // Reset bei erfolgreicher Verbindung
    });

    currentPeer.on('call', call => {
      statusEl.textContent = 'Status: eingehender Anruf…';
      console.log('Eingehender Anruf erhalten');
      
      // Debug: ICE-Verbindung überwachen (warten bis peerConnection verfügbar ist)
      setTimeout(async () => {
        if (call.peerConnection) {
          // Codec-Präferenzen auch auf Empfänger-Seite setzen
          const transceivers = call.peerConnection.getTransceivers();
          transceivers.forEach(async transceiver => {
            if (transceiver.receiver && transceiver.receiver.track) {
              const track = transceiver.receiver.track;
              if (track.kind === 'video') {
                console.log('📺 Video-Empfänger konfiguriert für H264/VP8 Priorität');
              }
            }
          });
          
          call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            console.log('ICE Connection State:', state);
            if (state === 'failed') {
              statusEl.textContent = 'Status: Verbindung fehlgeschlagen ❌ (NAT/Firewall Problem?)';
              console.log('Versuche Reconnect...');
              if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(() => {
                  statusEl.textContent = `Status: Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
                  createPeerConnection();
                }, 2000);
              }
            } else if (state === 'disconnected') {
              statusEl.textContent = 'Status: Verbindung unterbrochen 🔄 (versuche wieder zu verbinden...)';
            } else if (state === 'connected' || state === 'completed') {
              console.log('✅ P2P Verbindung erfolgreich hergestellt!');
              statusEl.textContent = 'Status: verbunden ✅';
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
      
      call.on('stream', stream => {
        console.log('🎥 Stream erhalten:', stream);
        console.log('📹 Video tracks:', stream.getVideoTracks().length);
        console.log('🔊 Audio tracks:', stream.getAudioTracks().length);
        
        // Stream-Details loggen
        stream.getVideoTracks().forEach((track, i) => {
          console.log(`📹 Video Track ${i} Settings:`, track.getSettings());
          console.log(`📹 Video Track ${i} State:`, track.readyState);
        });
        
        stream.getAudioTracks().forEach((track, i) => {
          console.log(`🔊 Audio Track ${i} Settings:`, track.getSettings());
          console.log(`🔊 Audio Track ${i} State:`, track.readyState);
        });
        
        remoteVideo.srcObject = stream;
        statusEl.textContent = 'Status: verbunden ✅';
        
        // 📱 ORIGINAL-SEITENVERHÄLTNIS beibehalten (1:1 wie Kamera)
        remoteVideo.onloadedmetadata = () => {
          const videoWidth = remoteVideo.videoWidth;
          const videoHeight = remoteVideo.videoHeight;
          const aspectRatio = videoWidth / videoHeight;
          
          console.log('📺 Video metadata geladen:', videoWidth + 'x' + videoHeight);
          console.log('📐 Original Aspect Ratio:', aspectRatio.toFixed(3));
          
          // WICHTIG: Video-Element auf ORIGINAL-Abmessungen setzen
          // Entferne alle vorherigen Styling-Overrides
          remoteVideo.style.width = '';
          remoteVideo.style.height = '';
          remoteVideo.style.maxWidth = '';
          remoteVideo.style.maxHeight = '';
          
          // Setze ECHTE Dimensionen basierend auf Original-Stream
          if (aspectRatio < 1) {
            // HOCHKANT (z.B. 720x1280) - zeige GENAU so an
            console.log('📱 HOCHKANT-Stream erkannt:', videoWidth + 'x' + videoHeight);
            remoteVideo.style.width = 'auto';
            remoteVideo.style.height = '80vh'; // Höhe begrenzen für Bildschirm
            remoteVideo.style.maxHeight = '80vh';
            
            console.log('✅ Hochkant-Video mit Original-Seitenverhältnis angezeigt');
          } else if (aspectRatio > 1.5) {
            // BREITBILD (z.B. 1280x720) - zeige GENAU so an  
            console.log('📺 BREITBILD-Stream erkannt:', videoWidth + 'x' + videoHeight);
            remoteVideo.style.width = '100%';
            remoteVideo.style.height = 'auto';
            remoteVideo.style.maxWidth = '100%';
            
            console.log('✅ Breitbild-Video mit Original-Seitenverhältnis angezeigt');
          } else {
            // QUADRATISCH oder LEICHT RECHTECKIG (z.B. 640x480, 800x600)
            console.log('⬜ QUADRAT/LEICHT-RECHTECKIG Stream erkannt:', videoWidth + 'x' + videoHeight);
            remoteVideo.style.width = 'auto';
            remoteVideo.style.height = '70vh';
            remoteVideo.style.maxHeight = '70vh';
            
            console.log('✅ Quadrat-Video mit Original-Seitenverhältnis angezeigt');
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
          
          console.log(`🎯 Video wird mit ORIGINAL-Seitenverhältnis ${aspectRatio.toFixed(3)} angezeigt`);
          console.log('📺 Video duration:', remoteVideo.duration);
        };
      });

      call.answer(); // Anruf annehmen
    });

    currentPeer.on('disconnected', () => {
      console.log('⚠️ Peer getrennt - versuche Reconnect');
      statusEl.textContent = 'Status: getrennt, versuche Reconnect 🔄';
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(() => {
          statusEl.textContent = `Status: Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
          createPeerConnection();
        }, 3000);
      }
    });
    
    currentPeer.on('error', err => {
      console.error('❌ Peer Fehler:', err);
      statusEl.textContent = 'Peer Fehler: ' + err.message;
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(() => {
          statusEl.textContent = `Status: Peer Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
          createPeerConnection();
        }, 3000);
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
