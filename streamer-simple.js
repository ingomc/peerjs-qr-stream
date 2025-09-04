export function initSimpleStreamerApp() {
  console.log('Simple Streamer App wird initialisiert (Fallback-Modus)');
  const statusEl = document.getElementById('status');
  const localVideo = document.getElementById('local');
  const viewerId = new URL(location.href).searchParams.get('id');
  document.getElementById('viewer').textContent = viewerId || '(fehlt)';

  let localStream;

  async function getCam() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        }, 
        audio: true 
      });
      console.log('Kamera aktiviert (Simple Mode)');
    } catch (err) {
      console.error('Kamera-Fehler (Simple Mode):', err);
      throw err;
    }
    
    localVideo.srcObject = localStream;
    console.log('Stream erstellt (Simple Mode):', localStream.getVideoTracks().length, 'Video +', localStream.getAudioTracks().length, 'Audio tracks');
  }

  async function startSimple() {
    if (!viewerId) { alert('Viewer-ID fehlt (?id=...)'); return; }
    statusEl.textContent = 'Status: initialisiere Kamera (Simple Mode)…';
    
    try {
      await getCam();
      statusEl.textContent = 'Status: verbinde (Simple Mode)…';

      // Einfache Konfiguration nur mit STUN
      const peer = new Peer({
        config: {
          'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      });
      
      peer.on('open', (id) => {
        console.log('Peer geöffnet mit ID (Simple Mode):', id);
        console.log('Rufe Viewer an (Simple Mode):', viewerId);
        
        const call = peer.call(viewerId, localStream);
        
        call.on('close', () => {
          statusEl.textContent = 'Status: Verbindung beendet (Simple Mode)';
          console.log('Anruf beendet (Simple Mode)');
        });
        
        call.on('error', e => { 
          statusEl.textContent = 'Fehler (Call Simple Mode): ' + e.type; 
          console.error('Call Fehler (Simple Mode):', e); 
        });

        statusEl.textContent = 'Status: Anruf gestartet ✅ (Simple Mode)';
      });
      
      peer.on('error', e => { 
        statusEl.textContent = 'Fehler (Simple Mode): ' + e.type; 
        console.error('Peer Fehler (Simple Mode):', e); 
        
        if (e.type === 'peer-unavailable') {
          statusEl.textContent = 'Fehler: Viewer nicht erreichbar ❌ (Simple Mode)';
        }
      });
      
    } catch (err) {
      statusEl.textContent = 'Kamera-Fehler (Simple Mode): ' + err.message;
      console.error('Kamera-Fehler (Simple Mode):', err);
    }
  }

  document.getElementById('btnStart').addEventListener('click', startSimple);
}
