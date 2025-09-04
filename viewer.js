export function initViewerApp() {
  console.log('Viewer App wird initialisiert (Browser ist bereit)');
  const remoteVideo = document.getElementById('remote');
  const statusEl = document.getElementById('status');
  const pidEl = document.getElementById('pid');
  const linkEl = document.getElementById('link');

  let currentPeer = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  function createPeer() {
    // Zurück zum Standard PeerJS Server mit M1 Mac optimierter Konfiguration
    const peer = new Peer({
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
        // M1 Mac spezifische Einstellungen
        'sdpSemantics': 'unified-plan'
      }
    });

    return peer;
  }

  function initPeer() {
    if (currentPeer) {
      currentPeer.destroy();
    }
    
    currentPeer = createPeer();
    
    currentPeer.on('open', id => {
      pidEl.textContent = id;
      console.log('Peer geöffnet mit ID:', id);
      reconnectAttempts = 0;
      
      const url = new URL(window.location.origin + window.location.pathname.replace('index.html','') + 'streamer.html');
      url.searchParams.set('id', id);
      linkEl.textContent = url.toString();
      
      // Clear previous QR code
      const qrDiv = document.getElementById('qr');
      qrDiv.innerHTML = '';
      
      new QRCode(qrDiv, {
        text: url.toString(), width: 256, height: 256,
        correctLevel: QRCode.CorrectLevel.M
      });
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
                  initPeer();
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
        
        // Erweiterte Video-Element-Überwachung
        remoteVideo.onloadedmetadata = () => {
          console.log('📺 Video metadata geladen:', remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight);
          console.log('📺 Video duration:', remoteVideo.duration);
          console.log('📺 Video ready state:', remoteVideo.readyState);
        };
        
        remoteVideo.oncanplay = () => {
          console.log('📺 Video kann abgespielt werden');
        };
        
        remoteVideo.onplay = () => {
          console.log('✅ Video startet erfolgreich!');
        };
        
        remoteVideo.onwaiting = () => {
          console.log('⏳ Video wartet auf Daten...');
        };
        
        remoteVideo.onstalled = () => {
          console.log('⚠️ Video-Stream unterbrochen');
        };
        
        remoteVideo.onerror = (e) => {
          console.error('❌ Video Fehler:', e);
          console.error('❌ Video Error Code:', remoteVideo.error?.code);
          console.error('❌ Video Error Message:', remoteVideo.error?.message);
          statusEl.textContent = 'Status: Video-Fehler ❌';
        };
        
        // Force play after short delay (helps with autoplay restrictions)
        setTimeout(() => {
          if (remoteVideo.paused) {
            console.log('🎬 Video manuell starten...');
            remoteVideo.play().catch(e => console.log('Autoplay verhindert:', e));
          }
        }, 500);
      });
      
      call.on('error', err => {
        console.error('Call error:', err);
        statusEl.textContent = 'Status: Anruf-Fehler ❌';
      });
      
      call.answer();
    });

    currentPeer.on('error', e => { 
      statusEl.textContent = 'Fehler: ' + e.type; 
      console.error(e);
      
      // Auto-reconnect bei Peer-Fehlern
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(() => {
          statusEl.textContent = `Status: Peer Reconnect-Versuch ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
          initPeer();
        }, 3000);
      }
    });

    document.getElementById('btnFS').onclick = () => {
      const el = remoteVideo; if (el.requestFullscreen) el.requestFullscreen();
    };
  }

  // Start initial peer connection
  initPeer();
}
