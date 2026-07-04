"use client";

import { create } from "zustand";
import type { MailMessage, MailMessageSummary } from "@/lib/mail/types";

export type IdentitySummary = {
  id: string;
  email: string;
  displayName?: string | null;
  color: string;
  type: string;
  connected: boolean;
  unread?: number;
};

type MailState = {
  identities: IdentitySummary[];
  activeIdentityId: string | "all";
  folder: string;
  messages: MailMessageSummary[];
  selectedId: string | null;
  selectedMessage: MailMessage | null;
  loadingList: boolean;
  loadingMessage: boolean;
  composeOpen: boolean;
  composeMode: "new" | "reply" | "replyAll" | "forward";
  composeFullscreen: boolean;
  searchQuery: string;
  selectedIds: string[];
  setIdentities: (identities: IdentitySummary[]) => void;
  setActiveIdentityId: (id: string | "all") => void;
  setFolder: (folder: string) => void;
  setMessages: (messages: MailMessageSummary[]) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedMessage: (message: MailMessage | null) => void;
  setLoadingList: (v: boolean) => void;
  setLoadingMessage: (v: boolean) => void;
  openCompose: (mode?: MailState["composeMode"]) => void;
  closeCompose: () => void;
  setComposeFullscreen: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
};

export const useMailStore = create<MailState>((set) => ({
  identities: [],
  activeIdentityId: "all",
  folder: "INBOX",
  messages: [],
  selectedId: null,
  selectedMessage: null,
  loadingList: false,
  loadingMessage: false,
  composeOpen: false,
  composeMode: "new",
  composeFullscreen: false,
  searchQuery: "",
  selectedIds: [],
  setIdentities: (identities) => set({ identities }),
  setActiveIdentityId: (activeIdentityId) => set({ activeIdentityId }),
  setFolder: (folder) => set({ folder, selectedId: null, selectedMessage: null }),
  setMessages: (messages) => set({ messages }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setSelectedMessage: (selectedMessage) => set({ selectedMessage }),
  setLoadingList: (loadingList) => set({ loadingList }),
  setLoadingMessage: (loadingMessage) => set({ loadingMessage }),
  openCompose: (composeMode = "new") => set({ composeOpen: true, composeMode }),
  closeCompose: () => set({ composeOpen: false, composeFullscreen: false, composeMode: "new" }),
  setComposeFullscreen: (composeFullscreen) => set({ composeFullscreen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),
}));
