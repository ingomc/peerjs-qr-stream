// NUR PEERJS VERBINDUNG
export class ConnectionManager {
  constructor() {
    this.peer = null;
    this.currentCall = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.statsInterval = null;
  }

  createPeer() {
    return new Peer({
      config: {
        'iceServers': [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: [
              'turn:openrelay.metered.ca:80', 
              'turn:openrelay.metered.ca:443'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });
  }

  async connect(viewerId, stream, onSuccess, onError) {
    this.peer = this.createPeer();
    
    this.peer.on('open', (id) => {
      console.log('✅ Peer verbunden:', id);
      
      this.currentCall = this.peer.call(viewerId, stream);
      
      // WICHTIG: Setze Video-Qualität SOFORT nach Call-Erstellung
      setTimeout(() => {
        if (this.currentCall && this.currentCall.peerConnection) {
          this.configureVideoQuality(this.currentCall.peerConnection, stream);
          this.startStatsMonitoring(this.currentCall.peerConnection);
        }
      }, 100); // Kurze Verzögerung damit peerConnection verfügbar ist
      
      this.currentCall.on('close', () => {
        console.log('❌ Call beendet');
        this.stopStatsMonitoring();
      });
      
      this.currentCall.on('error', (e) => {
        console.error('❌ Call Fehler:', e);
        this.stopStatsMonitoring();
        if (onError) onError(e);
      });

      if (onSuccess) onSuccess();
    });
    
    this.peer.on('error', (e) => {
      console.error('❌ Peer Fehler:', e);
      this.stopStatsMonitoring();
      if (onError) onError(e);
    });
  }

  configureVideoQuality(peerConnection, stream) {
    console.log('🔧 Konfiguriere Video-Qualität...');
    
    // Hole alle Sender
    const senders = peerConnection.getSenders();
    const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
    
    if (videoSender) {
      const parameters = videoSender.getParameters();
      
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      
      // ULTRA-HOHE BITRATE für lokale Verbindungen (bis 20 Mbps!)
      parameters.encodings[0].maxBitrate = 20000000; // 20 Mbps
      parameters.encodings[0].minBitrate = 5000000;  // 5 Mbps minimum
      parameters.encodings[0].priority = 'high';
      parameters.encodings[0].networkPriority = 'high';
      
      // KRITISCH: Keine Skalierung erlauben!
      parameters.encodings[0].scaleResolutionDownBy = 1.0;
      
      // Maximale Framerate
      parameters.encodings[0].maxFramerate = 30;
      
      videoSender.setParameters(parameters)
        .then(() => {
          console.log('✅ Video-Parameter gesetzt:', parameters.encodings[0]);
          console.log('🚀 Bitrate: 5-20 Mbps, Keine Skalierung!');
        })
        .catch(err => {
          console.error('❌ Fehler beim Setzen der Video-Parameter:', err);
        });
      
      // Track Settings loggen
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      console.log(`📹 Original Track: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
    }
  }

  startStatsMonitoring(peerConnection) {
    console.log('📊 Starte WebRTC Stats Monitoring...');
    
    let lastBytesSent = 0;
    let lastTimestamp = Date.now();
    
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats();
        let videoStats = null;
        
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            videoStats = report;
          }
        });
        
        if (videoStats) {
          // Berechne aktuelle Bitrate
          const now = Date.now();
          const bytesSent = videoStats.bytesSent;
          const timeDiff = (now - lastTimestamp) / 1000; // in Sekunden
          const bytesDiff = bytesSent - lastBytesSent;
          const currentBitrate = (bytesDiff * 8) / timeDiff / 1000000; // in Mbps
          
          console.log('═══ WEBRTC VIDEO STATS ═══');
          console.log(`📤 Bytes sent: ${(videoStats.bytesSent / 1024 / 1024).toFixed(2)} MB`);
          console.log(`📦 Packets sent: ${videoStats.packetsSent}`);
          console.log(`🎞️ Frames sent: ${videoStats.framesSent}`);
          console.log(`📏 Frame width: ${videoStats.frameWidth}x${videoStats.frameHeight}`);
          console.log(`🔧 Encoder: ${videoStats.encoderImplementation || 'unknown'}`);
          console.log(`🚀 Current Bitrate: ${currentBitrate.toFixed(2)} Mbps`);
          
          if (videoStats.qualityLimitationReason) {
            console.log(`⚠️ Quality Limitation: ${videoStats.qualityLimitationReason}`);
          }
          
          lastBytesSent = bytesSent;
          lastTimestamp = now;
        }
      } catch (err) {
        console.error('❌ Stats Error:', err);
      }
    }, 5000); // Alle 5 Sekunden
  }

  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      console.log('📊 Stats Monitoring gestoppt');
    }
  }

  disconnect() {
    this.stopStatsMonitoring();
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
