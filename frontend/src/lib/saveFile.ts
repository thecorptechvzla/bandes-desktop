import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface SaveFileFilters {
  name: string;
  extensions: string[];
}

// Guarda un Blob pidiendo al usuario dónde (diálogo nativo "Guardar como").
// En Tauri: save() devuelve la ruta elegida y la añade al scope de fs,
// luego se escribe el archivo. Si el usuario cancela devuelve null.
// En navegador (dev) usa el anchor clásico con URL.createObjectURL.
export async function saveFile(
  blob: Blob,
  suggestedName: string,
  filters: SaveFileFilters[] = [],
): Promise<string | null> {
  if (!isTauri) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  }

  const path = await save({
    defaultPath: suggestedName,
    filters,
  });
  if (!path) return null;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, bytes);
  return path;
}
