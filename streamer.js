/**
 * 🎯 Streamer App
 * Verwendet die vorhandenen Module: CameraManager, StreamManager, ConnectionManager
 */

import { CameraManager } from './camera-manager.js';
import { StreamManager } from './stream-manager.js';
import { ConnectionManager } from './connection-manager.js';

let cameraManager, streamManager, connectionManager;
let debugConsole;

function debugLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
  console.log(prefix, message);
  
  if (debugConsole) {
    const line = document.createElement('div');
    line.textContent = `${prefix} ${message}`;
    line.style.color = type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0';
    debugConsole.appendChild(line);
    debugConsole.scrollTop = debugConsole.scrollHeight;
  }
}

export function initStreamer() {
  console.log('═══════════════════════════════════════');
  console.log('🚀 PeerJS QR Stream - Streamer Starting');
  console.log('═══════════════════════════════════════');
  
  debugConsole = document.getElementById('debugConsole');
  const btnClear = document.getElementById('clearDebug');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      debugConsole.innerHTML = '';
    });
  }
  
  debugLog('🚀 Streamer App initialisiert');
  
  // Manager initialisieren
  cameraManager = new CameraManager(
    document.getElementById('cameraSelect'),
    document.getElementById('cameraStatus')
  );
  
  streamManager = new StreamManager(document.getElementById('local'));
  connectionManager = new ConnectionManager();
  
  // Viewer-ID aus URL extrahieren
  const params = new URLSearchParams(window.location.search);
  const viewerId = params.get('id');
  
  if (viewerId) {
    document.getElementById('viewer').textContent = viewerId;
    debugLog(`✅ Viewer-ID gefunden: ${viewerId}`);
  } else {
    document.getElementById('viewer').textContent = '❌ Keine ID in URL!';
    debugLog('❌ Keine Viewer-ID in URL gefunden!', 'error');
  }
  
  // NICHT automatisch Kameras laden - User muss Button klicken!
  debugLog('📹 Bereit - klicke "Kameras neu laden" für Berechtigung');
  
  // Refresh-Button
  document.getElementById('btnRefreshCameras').addEventListener('click', () => {
    debugLog('🔄 Kameras werden neu geladen...');
    cameraManager.loadCameras();
  });
  
  // Start-Button
  document.getElementById('btnStart').addEventListener('click', async () => {
    if (!viewerId) {
      alert('❌ Keine Viewer-ID! Bitte via QR-Code öffnen.');
      debugLog('❌ Start abgebrochen: Keine Viewer-ID', 'error');
      return;
    }
    
    const cameraId = cameraManager.getSelectedCameraId();
    if (!cameraId) {
      alert('❌ Bitte Kamera auswählen!');
      debugLog('❌ Start abgebrochen: Keine Kamera ausgewählt', 'error');
      return;
    }
    
    debugLog('🎬 Starte Streaming...');
    document.getElementById('status').textContent = 'Status: Starte Kamera...';
    
    try {
      // Qualität aus Select auslesen
      const qualitySelect = document.getElementById('qualitySelect');
      const quality = qualitySelect ? qualitySelect.value : 'medium';
      debugLog(`📊 Gewählte Qualität: ${quality}`);
      
      // Kamera starten mit Qualitätsprofil
      const stream = await streamManager.startCamera(cameraId, quality);
      debugLog('✅ Kamera gestartet');
      
      // Stream-Details loggen
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      debugLog(`📹 Stream Settings: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
      debugLog(`📹 Aspect Ratio: ${(settings.width/settings.height).toFixed(2)}`);
      debugLog(`📹 Device: ${settings.deviceId?.substring(0, 20)}...`);
      
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioSettings = audioTrack.getSettings();
        debugLog(`🔊 Audio: ${audioSettings.sampleRate}Hz, ${audioSettings.channelCount} channels`);
      }
      
      document.getElementById('status').textContent = 'Status: Verbinde mit Viewer...';
      
      // Mit Viewer verbinden
      await connectionManager.connect(
        viewerId,
        stream,
        () => {
          debugLog('✅ Erfolgreich mit Viewer verbunden!');
          document.getElementById('status').textContent = 'Status: Verbunden ✅';
          
          // Zeige finale Stats nach Verbindung
          setTimeout(() => {
            logStreamStats(stream);
          }, 2000);
        },
        (error) => {
          debugLog(`❌ Verbindungsfehler: ${error.message}`, 'error');
          document.getElementById('status').textContent = 'Status: Fehler ❌';
        }
      );
      
    } catch (error) {
      debugLog(`❌ Fehler: ${error.message}`, 'error');
      document.getElementById('status').textContent = `Status: Fehler - ${error.message}`;
      alert(`Fehler: ${error.message}`);
    }
  });
  
  // Stream Stats Logger
  function logStreamStats(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const settings = videoTrack.getSettings();
    const constraints = videoTrack.getConstraints();
    
    debugLog('═══ STREAM STATS ═══');
    debugLog(`📐 Auflösung: ${settings.width}x${settings.height}`);
    debugLog(`🎞️ Framerate: ${settings.frameRate}fps`);
    debugLog(`📊 Bitrate: ${settings.bitrate || 'auto'}`);
    debugLog(`🎯 Aspect Ratio: ${(settings.width/settings.height).toFixed(3)}`);
    debugLog(`🔧 Constraints: ${JSON.stringify(constraints)}`);
  }
}

// Auto-Start beim Laden
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStreamer);
} else {
  initStreamer();
}

export default initStreamer;
