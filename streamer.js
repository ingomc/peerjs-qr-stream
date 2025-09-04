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
          // � MAXIMALE AUFLÖSUNG für alle Geräte - keine Limits!
          let testConstraints = { 
            deviceId: { exact: camera.deviceId },
            width: { ideal: 4096 },  // 4K wenn verfügbar
            height: { ideal: 2160 }, // 4K Höhe
            frameRate: { ideal: 60, min: 30 }  // Beste Framerate
          };
          
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: testConstraints,
            audio: false
          });
          
          const videoTrack = testStream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          testStream.getTracks().forEach(track => track.stop());
          
          console.log(`✅ ${device.type} Kamera: ${label} → ${settings.width}x${settings.height}@${settings.frameRate}fps`);
          
          // 📷 Intelligente Kamera-Erkennung
          const isRearCamera = label.toLowerCase().includes('back') || 
                              label.toLowerCase().includes('rear') || 
                              label.toLowerCase().includes('hauptkamera') ||
                              label.toLowerCase().includes('environment') ||
                              (!label.toLowerCase().includes('front') && !label.toLowerCase().includes('user'));
          
          const icon = isRearCamera ? '📷' : '🤳';
          
          // 🏆 Qualitätsbewertung basierend auf Pixeln
          let qualityBadge = '';
          const totalPixels = settings.width * settings.height;
          if (totalPixels >= 3840*2160) qualityBadge = ' 🔥'; // 4K
          else if (totalPixels >= 1920*1080) qualityBadge = ' 🏆'; // Full HD
          else if (totalPixels >= 1280*720) qualityBadge = ' ⭐'; // HD
          else qualityBadge = ' ✅'; // Standard
          
          workingCameras.push({
            deviceId: camera.deviceId,
            label: label,
            icon: icon,
            resolution: `${settings.width}x${settings.height}`,
            qualityBadge: qualityBadge,
            pixels: totalPixels
          });
          
        } catch (testErr) {
          console.warn(`❌ 4K Test fehlgeschlagen für: ${label}, versuche Fallback...`);
          
          // 🔄 FALLBACK: Wenn 4K fehlschlägt, versuche Full HD
          try {
            let fallbackConstraints = { 
              deviceId: { exact: camera.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            };
            
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: fallbackConstraints,
              audio: false
            });
            
            const videoTrack = fallbackStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            fallbackStream.getTracks().forEach(track => track.stop());
            
            console.log(`✅ Fallback erfolgreich: ${label} → ${settings.width}x${settings.height}`);
            
            const icon = label.toLowerCase().includes('front') || label.toLowerCase().includes('user') ? '🤳' : '📷';
            const totalPixels = settings.width * settings.height;
            const qualityBadge = totalPixels >= 1920*1080 ? ' 🏆' : (totalPixels >= 1280*720 ? ' ⭐' : ' ✅');
            
            workingCameras.push({
              deviceId: camera.deviceId,
              label: label,
              icon: icon,
              resolution: `${settings.width}x${settings.height}`,
              qualityBadge: qualityBadge,
              pixels: totalPixels
            });
            
          } catch (fallbackErr) {
            console.warn(`⚠️ Auch Fallback fehlgeschlagen für: ${label}, füge trotzdem hinzu`);
            
            // 📱 IMMER HINZUFÜGEN: Auch wenn Test fehlschlägt
            const icon = label.toLowerCase().includes('front') || label.toLowerCase().includes('user') ? '🤳' : '📷';
            workingCameras.push({
              deviceId: camera.deviceId,
              label: label,
              icon: icon,
              resolution: 'Test fehlgeschlagen',
              qualityBadge: ' ❓',
              pixels: 0
            });
          }
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
        cameraStatus.textContent = '❌ Keine Kameras funktionsfähig';
        cameraStatus.style.color = 'red';
      } else {
        cameraStatus.textContent = `✅ ${workingCameras.length} Kameras bereit`;
        cameraStatus.style.color = 'green';
      }
      
    } catch (err) {
      console.error('❌ Fehler beim Laden der Kameras:', err);
      cameraStatus.textContent = `❌ Fehler: ${err.message}`;
      cameraStatus.style.color = 'red';
    }
  }

  cameraSelect.addEventListener('change', () => {
    selectedCameraId = cameraSelect.value === 'auto' ? null : cameraSelect.value;
    console.log('📷 Kamera gewählt:', selectedCameraId || 'Automatisch');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      getCam();
    }
  });

  btnRefreshCameras.addEventListener('click', async () => {
    try {
      cameraStatus.textContent = `🔐 Fordere ${device.type} Kamera-Berechtigung an...`;
      cameraStatus.style.color = '#666';
      
      // 📱 WICHTIG: Mehrere Berechtigungen für alle Kameras anfordern
      console.log('🔐 Fordere Kamera-Berechtigungen an...');
      
      // Erst Frontkamera
      try {
        const frontStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' } 
        });
        frontStream.getTracks().forEach(track => track.stop());
        console.log('✅ Front-Kamera Berechtigung erhalten');
      } catch (frontErr) {
        console.warn('⚠️ Front-Kamera nicht verfügbar');
      }
      
      // Dann Rückkamera
      try {
        const backStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        backStream.getTracks().forEach(track => track.stop());
        console.log('✅ Rück-Kamera Berechtigung erhalten');
      } catch (backErr) {
        console.warn('⚠️ Rück-Kamera nicht verfügbar');
      }
      
      // Generische Berechtigung für alle anderen
      try {
        const genericStream = await navigator.mediaDevices.getUserMedia({ video: true });
        genericStream.getTracks().forEach(track => track.stop());
        console.log('✅ Generische Kamera-Berechtigung erhalten');
      } catch (genericErr) {
        console.warn('⚠️ Generische Kamera-Berechtigung fehlgeschlagen');
      }
      
      // Kurz warten damit Browser alle Kameras registriert
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      // 🌐 INTERNET-OPTIMIERTE AUFLÖSUNG (reduziert für TURN-Server)
      const videoConstraints = {
        width: { ideal: 1920, max: 2560 },    // Maximal 1440p für Internet
        height: { ideal: 1080, max: 1440 },   // Maximal 1440p Höhe  
        frameRate: { ideal: 30, max: 30 },    // Reduzierte Framerate für Bandbreite
        advanced: [
          { width: { ideal: 1920 } },
          { height: { ideal: 1080 } },
          { frameRate: { ideal: 30 } }
        ]
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
      
      console.log(`${device.icon} ${device.type} Kamera aktiviert mit MAXIMALER Qualität!`);
      console.log('� Max Video Settings:', localStream.getVideoTracks()[0].getSettings());
      
    } catch (err) {
      console.warn(`⚠️ ${device.type} Fallback zu mittlerer Qualität:`, err.message);
      
      try {
        // 🎯 Erster Fallback: Mittlere Qualität für Internet
        let fallbackConstraints = { 
          width: { ideal: 1280 },    // 720p für bessere TURN-Kompatibilität
          height: { ideal: 720 },   
          frameRate: { ideal: 25 } 
        };
        
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: fallbackConstraints,
          audio: { echoCancellation: true, sampleRate: 44100 }
        });
        console.log(`✅ ${device.type} Internet-Fallback erfolgreich`);
      } catch (fallbackErr) {
        // 📱 Letzter Fallback: Minimale Qualität für schwache Verbindungen
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 },    // Sehr niedrig für TURN-Server
              height: { ideal: 480 },
              frameRate: { ideal: 15 } 
            },
            audio: { echoCancellation: true, sampleRate: 48000 }
          });
          console.log(`✅ ${device.type} Standard-Fallback erfolgreich`);
        } catch (finalErr) {
          throw new Error(`${device.type} Kamera nicht verfügbar: ` + finalErr.message);
        }
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
          // INTERNET-OPTIMIERTE TURN-Server
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
          {
            urls: [
              'turn:numb.viagenie.ca:3478',
              'turn:numb.viagenie.ca:3478?transport=tcp'
            ],
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ],
        'iceCandidatePoolSize': 30,       // Mehr Candidates für Internet
        'bundlePolicy': 'max-bundle',     // Internet-optimiert
        'rtcpMuxPolicy': 'require',
        'sdpSemantics': 'unified-plan',
        'iceTransportPolicy': 'relay'     // FORCIERE TURN-Server für Internet
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
