import { IconTile } from '../../components/IconTile';
import type { EditorIconAsset, EditorProject } from '../../types';

export function IconArtworkPreview({
  item,
  project,
  size,
}: {
  item: EditorIconAsset;
  project: EditorProject;
  size: number;
}) {
  return <IconTile item={item} project={project} size={size} showPlaceholder />;
}
