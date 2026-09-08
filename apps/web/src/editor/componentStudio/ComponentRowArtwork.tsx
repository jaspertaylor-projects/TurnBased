import { useEffect, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { CardStudioRow } from '../cardStudio/types';

/** Row artwork stays editable when the full template editor owns layout controls. */
export function ComponentRowArtwork({
  row,
  onAttach,
  onError,
}: {
  row?: CardStudioRow;
  onAttach: (rowId: string, artUrl: string) => void;
  onError: (message: string) => void;
}) {
  const attach = useRef(onAttach);
  const error = useRef(onError);
  const mounted = useRef(true);
  const pending = useRef<FileReader | null>(null);
  const request = useRef(0);
  useEffect(() => {
    attach.current = onAttach;
    error.current = onError;
  }, [onAttach, onError]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
      pending.current?.abort();
    };
  }, []);
  function cancelUpload() {
    request.current += 1;
    pending.current?.abort();
    pending.current = null;
  }
  if (!row) return null;
  return (
    <div data-layout="componentRowArtwork" className="component-row-artwork">
      <label>
        Artwork for {row.title || 'selected row'}
        <input
          type="url"
          aria-label="Selected row art URL"
          value={row.artUrl.startsWith('data:') ? '' : row.artUrl}
          placeholder={row.artUrl.startsWith('data:') ? 'Uploaded artwork attached' : 'https://…'}
          onChange={(event) => {
            cancelUpload();
            onAttach(row.id, event.target.value);
          }}
        />
      </label>
      <label className="card-studio-button card-studio-file-button">
        <ImagePlus size={14} />
        Upload art
        <input
          type="file"
          aria-label="Upload selected row artwork"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            cancelUpload();
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
              onError('Use a PNG, JPEG, WebP, or GIF image.');
              return;
            }
            if (file.size > 2_000_000) {
              onError('Choose an image smaller than 2 MB to keep your project easy to share.');
              return;
            }
            const rowId = row.id;
            const requestId = request.current;
            const reader = new FileReader();
            pending.current = reader;
            reader.onload = () => {
              if (
                mounted.current &&
                request.current === requestId &&
                typeof reader.result === 'string'
              ) {
                pending.current = null;
                attach.current(rowId, reader.result);
              }
            };
            reader.onerror = () => {
              if (mounted.current && request.current === requestId)
                error.current('The artwork could not be read.');
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {row.artUrl && (
        <button
          className="card-studio-icon-button"
          aria-label="Remove selected row artwork"
          onClick={() => {
            cancelUpload();
            onAttach(row.id, '');
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
