// NUR KAMERA-LISTE - STARTET NICHTS!
export class CameraManager {
  constructor(selectElement, statusElement) {
    this.select = selectElement;
    this.status = statusElement;
    this.cameras = [];
    this.hasPermission = false;
  }

  async loadCameras() {
    this.status.textContent = '📋 Prüfe Berechtigungen...';
    this.status.style.color = '#666';
    
    try {
      // Erst Berechtigung prüfen/anfordern
      if (!this.hasPermission) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
          this.hasPermission = true;
          console.log('✅ Kamera-Berechtigung erhalten');
        } catch (permErr) {
          console.error('❌ Berechtigung verweigert:', permErr);
          this.status.textContent = '❌ Kamera-Berechtigung verweigert';
          this.status.style.color = 'red';
          return;
        }
      }
      
      this.status.textContent = '📋 Lade Kamera-Liste...';
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices.filter(d => d.kind === 'videoinput');
      
      console.log(`📱 ${this.cameras.length} Kameras gefunden:`, this.cameras);
      
      this.select.innerHTML = '<option value="">-- Kamera auswählen --</option>';
      
      this.cameras.forEach((camera, i) => {
        const label = camera.label || `Kamera ${i + 1}`;
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = label;
        this.select.appendChild(option);
        console.log(`  ${i}: ${label} (${camera.deviceId})`);
      });
      
      if (this.cameras.length === 0) {
        this.status.textContent = '❌ Keine Kameras gefunden';
        this.status.style.color = 'red';
      } else {
        this.status.textContent = `✅ ${this.cameras.length} Kameras verfügbar`;
        this.status.style.color = 'green';
      }
      
    } catch (err) {
      console.error('❌ Fehler:', err);
      this.status.textContent = `❌ Fehler: ${err.message}`;
      this.status.style.color = 'red';
    }
  }

  getSelectedCameraId() {
    const value = this.select.value;
    console.log(`🎥 getSelectedCameraId(): "${value}"`);
    if (!value || value === '') {
      console.warn('⚠️ Keine Kamera ausgewählt (leerer value)');
      return null;
    }
    return value;
  }
}
