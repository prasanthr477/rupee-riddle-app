import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

export const getDeviceFingerprint = async (): Promise<string> => {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
};
