export function initStreamerApp() {
  console.log('📱 Multi-Device Streamer App (Hardware-Encoding optimiert)');
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
  let availableCameras = [];
  let selectedCameraId = null;

  // � DEVICE-DETECTION für optimale Einstellungen
  function detectDevice() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone')) {
      return { type: 'iPhone', icon: '🍎', encoding: 'H264-Hardware' };
    } else if (userAgent.includes('Android')) {
      return { type: 'Android', icon: '🤖', encoding: 'H264-Hardware' };
    } else {
      return { type: 'Unknown', icon: '📱', encoding: 'Software' };
    }
  }

  const device = detectDevice();
  console.log(`${device.icon} Device erkannt: ${device.type} mit ${device.encoding}`);

  // 📹 UNIVERSAL KAMERA-AUSWAHL (alle Geräte)
  async function loadAvailableCameras() {
    cameraStatus.textContent = `🧪 Lade ${device.type} Kameras...`;
    cameraStatus.style.color = '#666';
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableCameras = devices.filter(device => device.kind === 'videoinput');
      
      // 🔍 Prüfe ob Kamera-Labels verfügbar sind (= Berechtigung vorhanden)
      const hasPermission = availableCameras.some(camera => camera.label && camera.label !== '');
      
      if (!hasPermission && availableCameras.length > 0) {
        console.log('⚠️ Kameras gefunden, aber keine Labels - Berechtigung fehlt');
        cameraStatus.textContent = `🔐 ${availableCameras.length} Kameras gefunden - klicke "Neu laden" für Details`;
        cameraStatus.style.color = '#f57c00';
        
        cameraSelect.innerHTML = '<option value="auto">🤖 Automatisch (Berechtigung erforderlich)</option>';
        availableCameras.forEach((camera, i) => {
          cameraSelect.innerHTML += `<option value="${camera.deviceId}">📷 Kamera ${i + 1} (Berechtigung erforderlich)</option>`;
        });
        return;
      }
      
      console.log(`📱 ${availableCameras.length} ${device.type} Kameras gefunden:`, availableCameras);
      cameraStatus.textContent = `🔍 ${availableCameras.length} Kameras gefunden, teste Hardware-Encoding...`;
      
      cameraSelect.innerHTML = '<option value="auto">🤖 Automatisch (Rückkamera bevorzugt)</option>';
      
      const workingCameras = [];
      
      for (let i = 0; i < availableCameras.length; i++) {
        const camera = availableCameras[i];
        const label = camera.label || `Kamera ${i + 1}`;
        
        cameraStatus.textContent = `🧪 Teste ${i + 1}/${availableCameras.length}: ${label}`;
        
        try {
          // Hardware-Test mit optimaler Auflösung für das Gerät
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: camera.deviceId },
              width: { ideal: 720, max: 1280 },    // Flexibler für verschiedene Geräte
              height: { ideal: 1280, max: 1920 }   // S25U kann mehr, iPhone XS weniger
            },
            audio: false
          });
          
          const videoTrack = testStream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          testStream.getTracks().forEach(track => track.stop());
          
          console.log(`✅ iPhone XS Kamera funktioniert: ${settings.width}x${settings.height}`);
          
          const icon = label.toLowerCase().includes('front') || label.toLowerCase().includes('user') ? '🤳' : '📷';
          let qualityBadge = '';
          const totalPixels = settings.width * settings.height;
          if (totalPixels >= 720*1280) qualityBadge = ' 🏆';
          else if (totalPixels >= 540*960) qualityBadge = ' ⭐';
          else qualityBadge = ' ✅';
          
          workingCameras.push({
            deviceId: camera.deviceId,
            label: label,
            icon: icon,
            resolution: `${settings.width}x${settings.height}`,
            qualityBadge: qualityBadge,
            pixels: totalPixels
          });
          
        } catch (testErr) {
          console.warn(`❌ iPhone XS Kamera nicht verfügbar: ${label}`);
        }
      }
      
      workingCameras.sort((a, b) => b.pixels - a.pixels);
      
      workingCameras.forEach((camera) => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = `${camera.icon} ${camera.label} (${camera.resolution})${camera.qualityBadge}`;
        cameraSelect.appendChild(option);
      });
      
      if (workingCameras.length === 0) {
        cameraStatus.textContent = '❌ Keine iPhone XS Kameras funktionsfähig';
        cameraStatus.style.color = 'red';
      } else {
        cameraStatus.textContent = `✅ ${workingCameras.length} iPhone XS Kameras bereit`;
        cameraStatus.style.color = 'green';
      }
      
    } catch (err) {
      console.error('❌ Fehler beim Laden der iPhone XS Kameras:', err);
      cameraStatus.textContent = `❌ Fehler: ${err.message}`;
      cameraStatus.style.color = 'red';
    }
  }

  cameraSelect.addEventListener('change', () => {
    selectedCameraId = cameraSelect.value === 'auto' ? null : cameraSelect.value;
    console.log('📷 iPhone XS Kamera gewählt:', selectedCameraId || 'Automatisch');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      getCam();
    }
  });

  btnRefreshCameras.addEventListener('click', async () => {
    try {
      cameraStatus.textContent = `🔐 Fordere ${device.type} Kamera-Berechtigung an...`;
      cameraStatus.style.color = '#666';
      
      // 📱 WICHTIG: Zuerst Kamera-Berechtigung anfordern
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('✅ Kamera-Berechtigung erhalten');
      
      // Temp-Stream sofort wieder stoppen
      tempStream.getTracks().forEach(track => track.stop());
      
      // Jetzt können wir alle Kameras richtig erkennen
      await loadAvailableCameras();
      
    } catch (error) {
      console.error('❌ Kamera-Berechtigung verweigert:', error);
      cameraStatus.textContent = `❌ ${device.type} Kamera-Berechtigung verweigert`;
      cameraStatus.style.color = '#d32f2f';
    }
  });

  async function getCam() {
    try {
      // 🎯 NATIVE KAMERA-AUFLÖSUNG verwenden (keine erzwungenen Constraints)
      const videoConstraints = {
        frameRate: { ideal: 30 }  // Nur Framerate optimieren, Rest nativ lassen
      };

      if (selectedCameraId) {
        videoConstraints.deviceId = { exact: selectedCameraId };
        console.log('📷 Verwende spezifische Kamera:', selectedCameraId);
      } else {
        videoConstraints.facingMode = { ideal: 'environment' };
        console.log('🤖 Automatische Kamera (Rückkamera bevorzugt)');
      }

      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 2
        }
      });
      
      console.log(`${device.icon} ${device.type} Kamera aktiviert - verwendet native Auflösung!`);
      console.log('📹 Native Video Settings:', localStream.getVideoTracks()[0].getSettings());
      
    } catch (err) {
      console.warn(`⚠️ ${device.type} Fallback wird verwendet:`, err.message);
      
      try {
        // 🎯 Auch Fallback ohne erzwungene Auflösung
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            frameRate: { ideal: 30 }  // Nur Framerate, keine Auflösungs-Zwang
          }, 
          audio: { echoCancellation: true, sampleRate: 48000 }
        });
        console.log(`✅ ${device.type} Fallback erfolgreich mit nativer Auflösung`);
      } catch (fallbackErr) {
        throw new Error(`${device.type} Kamera nicht verfügbar: ` + fallbackErr.message);
      }
    }
    
    localVideo.srcObject = localStream;
    
    const videoTrack = localStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
    console.log(`🎥 ${device.type} Stream: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
    console.log(`📐 Video wird automatisch per CSS angepasst - keine JavaScript-Manipulation nötig!`);
  }

  function createPeer() {
    return new Peer({
      config: {
        'iceServers': [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        'iceCandidatePoolSize': 10,
        'bundlePolicy': 'max-bundle',        // WLAN-optimiert
        'rtcpMuxPolicy': 'require',
        'sdpSemantics': 'unified-plan',
        'iceTransportPolicy': 'all'
      }
    });
  }

  async function startConnection() {
    if (!viewerId) { 
      alert('Viewer-ID fehlt (?id=...)'); 
      return; 
    }
    
    statusEl.textContent = 'Status: iPhone XS Kamera wird initialisiert…';
    
    try {
      await getCam();
      statusEl.textContent = 'Status: verbinde mit WLAN-optimiertem Streaming…';

      const peer = createPeer();
      
      peer.on('open', (id) => {
        console.log('🍎 iPhone XS Peer verbunden:', id);
        
        const call = peer.call(viewerId, localStream);
        
        // 📱 iPhone XS Hardware-Codec-Optimierung
        setTimeout(async () => {
          if (call.peerConnection) {
            const transceivers = call.peerConnection.getTransceivers();
            transceivers.forEach(async transceiver => {
              if (transceiver.sender && transceiver.sender.track && transceiver.sender.track.kind === 'video') {
                const params = transceiver.sender.getParameters();
                if (params.codecs) {
                  params.codecs = params.codecs.sort((a, b) => {
                    // H264 Hardware-Encoder für iPhone XS priorisieren
                    if (a.mimeType.includes('H264') && a.sdpFmtpLine?.includes('profile-level-id=42001f')) return -1;
                    if (b.mimeType.includes('H264') && b.sdpFmtpLine?.includes('profile-level-id=42001f')) return 1;
                    if (a.mimeType.includes('H264')) return -1;
                    if (b.mimeType.includes('H264')) return 1;
                    return 0;
                  });
                  console.log('🍎 iPhone XS Hardware-Codecs:', params.codecs.map(c => c.mimeType));
                  await transceiver.sender.setParameters(params);
                }
              }
            });
            
            // WLAN-optimierte Bitrate
            setTimeout(async () => {
              const senders = call.peerConnection.getSenders();
              senders.forEach(async sender => {
                if (sender.track && sender.track.kind === 'video') {
                  const params = sender.getParameters();
                  
                  if (params.encodings && params.encodings.length > 0) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    const settings = videoTrack.getSettings();
                    const pixels = settings.width * settings.height;
                    
                    let targetBitrate = pixels >= 720*1280 ? 8000000 : 6000000; // 8/6 Mbps WLAN
                    
                    params.encodings[0].maxBitrate = targetBitrate;
                    params.encodings[0].maxFramerate = 30;
                    params.encodings[0].priority = 'high';
                    
                    console.log(`📶 iPhone XS WLAN-Bitrate: ${targetBitrate/1000000} Mbps`);
                    await sender.setParameters(params);
                  }
                }
              });
            }, 1000);
          }
        }, 500);
        
        call.on('close', () => {
          statusEl.textContent = 'Status: iPhone XS Streaming beendet';
        });
        
        call.on('error', e => { 
          statusEl.textContent = 'iPhone XS Fehler: ' + e.type; 
        });

        statusEl.textContent = 'Status: iPhone XS Hardware-Streaming aktiv ✅';
      });
      
      peer.on('error', e => { 
        statusEl.textContent = 'iPhone XS Peer Fehler: ' + e.type; 
        console.error('iPhone XS Peer Fehler:', e);
        
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(() => {
            statusEl.textContent = `iPhone XS Reconnect ${reconnectAttempts}/${maxReconnectAttempts} 🔄`;
            peer.destroy();
            startConnection();
          }, 3000);
        }
      });
      
    } catch (err) {
      statusEl.textContent = 'iPhone XS Kamera-Fehler: ' + err.message;
      console.error('iPhone XS Kamera-Fehler:', err);
    }
  }

  document.getElementById('btnStart').addEventListener('click', startConnection);
  
  // iPhone XS Kameras beim Start laden
  loadAvailableCameras();
}
