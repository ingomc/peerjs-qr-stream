export function initFirewallBypassViewer() {
  console.log('🔥 Firewall Bypass Viewer wird initialisiert');
  const remoteVideo = document.getElementById('remote');
  const statusEl = document.getElementById('status');
  const pidEl = document.getElementById('pid');
  const linkEl = document.getElementById('link');

  // AGGRESSIVE Firewall-Bypass-Konfiguration
  const peer = new Peer({
    config: {
      'iceServers': [
        // Mehr STUN Server für bessere NAT-Erkennung
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        
        // MEHRERE TURN Server als Fallbacks
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
        {
          urls: [
            'turn:relay1.expressturn.com:3478',
            'turn:relay1.expressturn.com:3478?transport=tcp'
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
        }
      ],
      'iceCandidatePoolSize': 50, // Viel mehr Candidates
      'bundlePolicy': 'max-bundle',
      'rtcpMuxPolicy': 'require',
      'sdpSemantics': 'unified-plan',
      // AGGRESSIVE ICE-Einstellungen
      'iceTransportPolicy': 'all' // Alle Verbindungstypen erlauben
    }
  });

  peer.on('open', id => {
    pidEl.textContent = id;
    console.log('🔥 Firewall Bypass Peer geöffnet mit ID:', id);
    const url = new URL(window.location.origin + window.location.pathname.replace('index.html','') + 'streamer.html');
    url.searchParams.set('id', id);
    url.searchParams.set('bypass', '1'); // Spezielle Bypass-Mode URL
    linkEl.textContent = url.toString();
    
    const qrDiv = document.getElementById('qr');
    qrDiv.innerHTML = '';
    
    new QRCode(qrDiv, {
      text: url.toString(), width: 256, height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
  });

  peer.on('call', call => {
    statusEl.textContent = 'Status: eingehender Anruf (Firewall Bypass)…';
    console.log('🔥 Eingehender Anruf erhalten (Bypass Mode)');
    
    // SOFORTIGE Antwort ohne Verzögerung
    call.answer();
    
    // Aggressive ICE-Überwachung
    setTimeout(() => {
      if (call.peerConnection) {
        let iceGatheringComplete = false;
        
        call.peerConnection.addEventListener('icegatheringstatechange', () => {
          console.log('🧊 ICE Gathering State:', call.peerConnection.iceGatheringState);
          if (call.peerConnection.iceGatheringState === 'complete') {
            iceGatheringComplete = true;
            console.log('🧊 ICE Gathering abgeschlossen');
          }
        });

        call.peerConnection.addEventListener('iceconnectionstatechange', () => {
          const state = call.peerConnection.iceConnectionState;
          console.log('🔥 ICE Connection State (Bypass):', state);
          
          if (state === 'connected' || state === 'completed') {
            console.log('✅ FIREWALL BYPASS ERFOLGREICH!');
            statusEl.textContent = 'Status: Firewall umgangen ✅';
          } else if (state === 'failed') {
            console.log('❌ Firewall Bypass fehlgeschlagen - versuche Reconnect');
            statusEl.textContent = 'Status: Firewall zu restriktiv ❌';
          } else if (state === 'disconnected') {
            console.log('⚠️ Verbindung unterbrochen - Firewall Problem');
            statusEl.textContent = 'Status: Firewall blockiert Verbindung 🔥';
          }
        });

        // Connection State auch überwachen
        call.peerConnection.addEventListener('connectionstatechange', () => {
          const state = call.peerConnection.connectionState;
          console.log('🔗 Connection State (Bypass):', state);
        });
      }
    }, 50); // Noch schneller

    call.on('stream', stream => {
      console.log('🎥 Stream erhalten (Firewall Bypass):', stream);
      remoteVideo.srcObject = stream;
      statusEl.textContent = 'Status: Stream empfangen - kämpfe gegen Firewall 🔥';
      
      // Aggressive Video-Behandlung
      remoteVideo.onplay = () => {
        console.log('✅ VIDEO LÄUFT TROTZ FIREWALL!');
        statusEl.textContent = 'Status: Video läuft ✅ (Firewall umgangen)';
      };
      
      // Sofort play versuchen
      setTimeout(() => {
        remoteVideo.play().catch(e => console.log('Autoplay blocked:', e));
      }, 100);
    });
    
    call.on('error', err => {
      console.error('🔥 Firewall Bypass Call Error:', err);
      statusEl.textContent = 'Status: Firewall blockiert Anruf ❌';
    });
  });

  peer.on('error', e => { 
    console.error('🔥 Firewall Bypass Peer Error:', e);
    statusEl.textContent = 'Status: Firewall Problem - ' + e.type; 
  });

  document.getElementById('btnFS').onclick = () => {
    const el = remoteVideo; if (el.requestFullscreen) el.requestFullscreen();
  };
}
