import { createContext, useContext, useState, ReactNode } from 'react';

interface GuestDetails {
  name: string;
  email: string;
  phone: string;
}

interface GuestContextType {
  guestDetails: GuestDetails | null;
  setGuestDetails: (details: GuestDetails) => void;
  clearGuestDetails: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const GuestProvider = ({ children }: { children: ReactNode }) => {
  const [guestDetails, setGuestDetailsState] = useState<GuestDetails | null>(() => {
    const stored = localStorage.getItem('guestDetails');
    return stored ? JSON.parse(stored) : null;
  });

  const setGuestDetails = (details: GuestDetails) => {
    setGuestDetailsState(details);
    localStorage.setItem('guestDetails', JSON.stringify(details));
  };

  const clearGuestDetails = () => {
    setGuestDetailsState(null);
    localStorage.removeItem('guestDetails');
  };

  return (
    <GuestContext.Provider value={{ guestDetails, setGuestDetails, clearGuestDetails }}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
};
