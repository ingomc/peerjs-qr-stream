export function initSimpleViewerApp() {
  console.log('Simple Viewer App wird initialisiert (Fallback-Modus)');
  const remoteVideo = document.getElementById('remote');
  const statusEl = document.getElementById('status');
  const pidEl = document.getElementById('pid');
  const linkEl = document.getElementById('link');

  // Einfache Konfiguration nur mit STUN (für lokale/einfache Netzwerke)
  const peer = new Peer({
    config: {
      'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', id => {
    pidEl.textContent = id;
    console.log('Peer geöffnet mit ID (Simple Mode):', id);
    const url = new URL(window.location.origin + window.location.pathname.replace('index.html','') + 'streamer.html');
    url.searchParams.set('id', id);
    url.searchParams.set('simple', '1');
    linkEl.textContent = url.toString();
    
    // Clear previous QR code
    const qrDiv = document.getElementById('qr');
    qrDiv.innerHTML = '';
    
    new QRCode(qrDiv, {
      text: url.toString(), width: 256, height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
  });

  peer.on('call', call => {
    statusEl.textContent = 'Status: eingehender Anruf (Simple Mode)…';
    console.log('Eingehender Anruf erhalten (Simple Mode)');
    
    call.on('stream', stream => {
      console.log('Stream erhalten (Simple Mode):', stream);
      remoteVideo.srcObject = stream;
      statusEl.textContent = 'Status: verbunden ✅ (Simple Mode)';
    });
    
    call.on('error', err => {
      console.error('Call error (Simple Mode):', err);
      statusEl.textContent = 'Status: Anruf-Fehler ❌ (Simple Mode)';
    });
    
    call.answer();
  });

  peer.on('error', e => { 
    statusEl.textContent = 'Fehler (Simple Mode): ' + e.type; 
    console.error('Simple Mode Error:', e); 
  });

  document.getElementById('btnFS').onclick = () => {
    const el = remoteVideo; if (el.requestFullscreen) el.requestFullscreen();
  };
}
