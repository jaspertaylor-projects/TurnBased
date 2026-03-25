import type {
  BoardBorderStyle,
  BoardSurfaceTextureId,
} from '@turnbased/engine-components';

export interface BoardSurfaceAppearance {
  background: string;
  textureId?: BoardSurfaceTextureId | null;
  textureOpacity?: number;
  borderColor?: string | null;
  borderWidth?: number;
  borderStyle?: BoardBorderStyle;
}

export interface BoardSurfaceTextureStyle {
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  filter?: string;
}

export function getBoardSurfaceTextureStyle(textureId: BoardSurfaceTextureId | null | undefined, opacity?: number): BoardSurfaceTextureStyle {
  const resolvedOpacity = opacity ?? 0.3;
  const filterString = `grayscale(100%) opacity(${Math.round(resolvedOpacity * 100)}%)`;

  switch (textureId) {
    case 'felt':
      return {
        backgroundImage: "url('/textures/felt_texture.png')",
        backgroundSize: '256px 256px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'wood':
      return {
        backgroundImage: "url('/textures/wood_texture.png')",
        backgroundSize: '256px 256px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'marble':
      return {
        backgroundImage: "url('/textures/marble_texture.png')",
        backgroundSize: '350px 350px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'leather':
      return {
        backgroundImage: "url('/textures/leather_texture.png')",
        backgroundSize: '200px 200px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'stone':
      return {
        backgroundImage: "url('/textures/stone_texture.png')",
        backgroundSize: '400px 400px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'sand':
      return {
        backgroundImage: "url('/textures/sand_texture.png')",
        backgroundSize: '300px 300px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'metal':
      return {
        backgroundImage: "url('/textures/metal_texture.png')",
        backgroundSize: '300px 300px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'water':
      return {
        backgroundImage: "url('/textures/water_texture.png')",
        backgroundSize: '300px 300px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'grass':
      return {
        backgroundImage: "url('/textures/grass_texture.png')",
        backgroundSize: '300px 300px',
        backgroundRepeat: 'repeat',
        filter: filterString,
      };
    case 'none':
    default:
      return {};
  }
}
