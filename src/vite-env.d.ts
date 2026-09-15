/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}

type BackupStartIn = FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: BackupStartIn
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemDirectoryHandle {
  queryPermission: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>
  requestPermission: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>
}

interface Window {
  showDirectoryPicker: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
}
