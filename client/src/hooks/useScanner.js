import { useState, useEffect, useRef } from 'react';

export const useScanner = () => {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scannedIsbn, setScannedIsbn] = useState(null);
  
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const videoElementRef = useRef(null);

  // Dynamically load ZXing EAN Reader library CDN
  const loadZXing = () => {
    return new Promise((resolve, reject) => {
      if (window.ZXing) {
        resolve(window.ZXing);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js';
      script.async = true;
      script.onload = () => resolve(window.ZXing);
      script.onerror = () => reject(new Error('Failed to load ZXing scanner library CDN'));
      document.body.appendChild(script);
    });
  };

  const startScanning = async (videoElementId, onScanSuccess) => {
    setLoading(true);
    setError(null);
    setScannedIsbn(null);
    setActive(true);

    videoElementRef.current = document.getElementById(videoElementId);
    if (!videoElementRef.current) {
      setError('Video viewport element not found');
      setLoading(false);
      return;
    }

    try {
      const zxing = await loadZXing();
      if (!codeReaderRef.current) {
        codeReaderRef.current = new zxing.BrowserMultiFormatReader();
      }

      const videoDevices = await codeReaderRef.current.listVideoInputDevices();
      if (videoDevices.length === 0) {
        throw new Error('No camera devices detected');
      }

      let selectedDeviceId = videoDevices[0].deviceId;
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') || 
        device.label.toLowerCase().includes('environment')
      );
      if (backCamera) {
        selectedDeviceId = backCamera.deviceId;
      }

      const constraints = {
        video: {
          deviceId: { exact: selectedDeviceId },
          width: { min: 640, ideal: 1920, max: 3840 },
          height: { min: 480, ideal: 1080, max: 2160 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoElementRef.current.srcObject = stream;
      videoElementRef.current.setAttribute('playsinline', true);
      videoElementRef.current.play();

      setLoading(false);

      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
        const scanNative = async () => {
          if (!videoElementRef.current) return;
          if (videoElementRef.current.readyState === videoElementRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoElementRef.current);
              if (barcodes.length > 0) {
                const isbn = barcodes[0].rawValue.trim().replace(/[-\s]/g, '');
                if (/^\d{9,13}[\dX]$/i.test(isbn)) {
                  setScannedIsbn(isbn);
                  stopScanning();
                  if (onScanSuccess) onScanSuccess(isbn);
                  return;
                }
              }
            } catch (e) {}
          }
          if (videoElementRef.current) {
            requestAnimationFrame(scanNative);
          }
        };
        requestAnimationFrame(scanNative);
      } else {
        codeReaderRef.current.decodeFromVideoDevice(
          selectedDeviceId,
          videoElementId,
          (result, err) => {
            if (result) {
              const isbn = result.text.trim().replace(/[-\s]/g, '');
              if (/^\d{9,13}[\dX]$/i.test(isbn)) {
                setScannedIsbn(isbn);
                stopScanning();
                if (onScanSuccess) onScanSuccess(isbn);
              }
            }
            if (err && err.name !== 'NotFoundException') {
              console.warn('ZXing scanner warn:', err.message || err);
            }
          }
        );
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Camera setup failed');
      setLoading(false);
      setActive(false);
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
      videoElementRef.current = null;
    }
    setActive(false);
  };

  // Autoclean streams on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return {
    active,
    loading,
    error,
    scannedIsbn,
    startScanning,
    stopScanning
  };
};
