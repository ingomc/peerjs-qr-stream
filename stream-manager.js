// NUR KAMERA STARTEN
export class StreamManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
  }

  getQualityConstraints(quality = 'medium') {
    const profiles = {
      'ultra-low': {
        width: { min: 640, ideal: 640 },
        height: { min: 480, ideal: 480 },
        frameRate: { min: 15, ideal: 15 }
      },
      'low': {
        width: { min: 960, ideal: 960 },
        height: { min: 720, ideal: 720 },
        frameRate: { min: 20, ideal: 20 }
      },
      'medium': {
        width: { min: 1280, ideal: 1280 },
        height: { min: 720, ideal: 720 },
        frameRate: { min: 25, ideal: 25 }
      },
      'high': {
        width: { min: 1920, ideal: 1920 },
        height: { min: 1080, ideal: 1080 },
        frameRate: { min: 30, ideal: 30 }
      }
    };
    
    return profiles[quality] || profiles['medium'];
  }

  async startCamera(cameraId, quality = 'medium') {
    if (!cameraId) {
      throw new Error('Keine Kamera ausgewählt!');
    }

    console.log(`📷 Starte Kamera: ${cameraId} mit Qualität: ${quality}`);

    const videoConstraints = this.getQualityConstraints(quality);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          deviceId: { exact: cameraId },
          ...videoConstraints
        },
        audio: false // KEIN AUDIO
      });
      
      this.video.srcObject = this.stream;
      
      const settings = this.stream.getVideoTracks()[0].getSettings();
      console.log(`🎥 Stream: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
      console.log(`📊 Qualitätsprofil: ${quality}`);
      
      return this.stream;
      
    } catch (err) {
      console.warn('⚠️ Fallback mit reduzierten Constraints:', err.message);
      
      // Fallback ohne max constraints
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          deviceId: { exact: cameraId },
          width: videoConstraints.width.ideal,
          height: videoConstraints.height.ideal,
          frameRate: videoConstraints.frameRate.ideal
        },
        audio: false // KEIN AUDIO
      });
      
      this.video.srcObject = this.stream;
      console.log('✅ Fallback erfolgreich');
      
      return this.stream;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  getStream() {
    return this.stream;
  }
}
