"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import ContactCardModal from "@/components/ContactCardModal";

interface ContactModalContextValue {
  openContact: (id: string) => void;
}

const ContactModalContext = createContext<ContactModalContextValue | null>(null);

export function useContactModal(): ContactModalContextValue {
  const ctx = useContext(ContactModalContext);
  if (!ctx) throw new Error("useContactModal must be used inside ContactModalProvider");
  return ctx;
}

export function ContactModalProvider({ children }: { children: ReactNode }) {
  const [contactId, setContactId] = useState<string | null>(null);

  const openContact = useCallback((id: string) => {
    setContactId(id);
  }, []);

  const onClose = useCallback(() => {
    setContactId(null);
  }, []);

  return (
    <ContactModalContext.Provider value={{ openContact }}>
      {children}
      <ContactCardModal contactId={contactId} onClose={onClose} />
    </ContactModalContext.Provider>
  );
}
