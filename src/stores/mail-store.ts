"use client";

import { create } from "zustand";
import type { MailFolder, MailMessage, MailMessageSummary } from "@/lib/mail/types";

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
  workspaceRole: string | null;
  activeIdentityId: string | "all";
  folder: string;
  folders: MailFolder[];
  foldersReady: boolean;
  messages: MailMessageSummary[];
  selectedId: string | null;
  selectedMessage: MailMessage | null;
  loadingList: boolean;
  listError: string | null;
  loadingMessage: boolean;
  composeOpen: boolean;
  composeMode: "new" | "reply" | "replyAll" | "forward";
  composeFullscreen: boolean;
  searchQuery: string;
  selectedIds: string[];
  setIdentities: (identities: IdentitySummary[]) => void;
  setWorkspaceRole: (role: string | null) => void;
  setActiveIdentityId: (id: string | "all") => void;
  setFolder: (folder: string) => void;
  setFolders: (folders: MailFolder[]) => void;
  setMessages: (messages: MailMessageSummary[]) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedMessage: (message: MailMessage | null) => void;
  closeMessage: () => void;
  setLoadingList: (v: boolean) => void;
  setListError: (error: string | null) => void;
  setLoadingMessage: (v: boolean) => void;
  openCompose: (mode?: MailState["composeMode"]) => void;
  closeCompose: () => void;
  setComposeFullscreen: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  refreshMessages: () => Promise<void>;
};

export const useMailStore = create<MailState>((set, get) => ({
  identities: [],
  workspaceRole: null,
  activeIdentityId: "all",
  folder: "INBOX",
  folders: [],
  foldersReady: false,
  messages: [],
  selectedId: null,
  selectedMessage: null,
  loadingList: false,
  listError: null,
  loadingMessage: false,
  composeOpen: false,
  composeMode: "new",
  composeFullscreen: false,
  searchQuery: "",
  selectedIds: [],
  setIdentities: (identities) => set({ identities }),
  setWorkspaceRole: (workspaceRole) => set({ workspaceRole }),
  setActiveIdentityId: (activeIdentityId) =>
    set({
      activeIdentityId,
      folder: "INBOX",
      folders: [],
      foldersReady: false,
      messages: [],
      selectedId: null,
      selectedMessage: null,
    }),
  setFolder: (folder) => set({ folder }),
  setFolders: (folders) => set({ folders, foldersReady: true }),
  setMessages: (messages) => set({ messages }),
  setSelectedId: (selectedId) =>
    set(selectedId ? { selectedId } : { selectedId: null, selectedMessage: null }),
  setSelectedMessage: (selectedMessage) => set({ selectedMessage }),
  closeMessage: () => set({ selectedId: null, selectedMessage: null }),
  setLoadingList: (loadingList) => set({ loadingList }),
  setListError: (listError) => set({ listError }),
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
  refreshMessages: async () => {
    set({ loadingList: true, listError: null });
    try {
      const { folder, activeIdentityId } = get();
      const query = new URLSearchParams({ folder });
      if (activeIdentityId !== "all") query.set("identityId", activeIdentityId);
      const res = await fetch(`/api/mail/messages?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);
      const data = await res.json();
      set({ messages: data.messages });
    } catch (error) {
      set({ listError: error instanceof Error ? error.message : "Failed to load messages" });
    } finally {
      set({ loadingList: false });
    }
  },
}));
