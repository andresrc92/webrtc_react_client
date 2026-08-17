// Map metadata + coordinate transforms.
//
// Values mirror the ROS map_server YAML shipped with the map
// (public/map/map.yaml). Embedding them here gives the UI the *same frame of
// reference* the robots use, so world coordinates (meters) and image pixels
// convert consistently across robots and the console.
//
// ROS map conventions:
//   - `resolution` is meters per pixel.
//   - `origin` is the world pose [x, y, theta] of the LOWER-LEFT pixel.
//   - Image pixel (0,0) is the TOP-left; world +y points up, so the image y
//     axis is flipped relative to world y.

export interface MapMeta {
  image: string;
  resolution: number;
  origin: [number, number, number];
  negate: number;
  occupiedThresh: number;
  freeThresh: number;
  width: number;
  height: number;
}

export const MAP_META: MapMeta = {
  image: "/map/map.refinery.png",
  resolution: 0.05,
  origin: [-10.7403, -7.80462, 0.0],
  negate: 0,
  occupiedThresh: 0.5,
  freeThresh: 0.196,
  width: 2029,
  height: 1486,
};

export interface PixelPoint {
  x: number;
  y: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

// World meters -> image pixels (top-left origin).
export function worldToPixel(world: WorldPoint, meta: MapMeta = MAP_META): PixelPoint {
  const px = (world.x - meta.origin[0]) / meta.resolution;
  const pyFromBottom = (world.y - meta.origin[1]) / meta.resolution;
  return { x: px, y: meta.height - pyFromBottom };
}

// Image pixels (top-left origin) -> world meters.
export function pixelToWorld(pixel: PixelPoint, meta: MapMeta = MAP_META): WorldPoint {
  const x = pixel.x * meta.resolution + meta.origin[0];
  const y = (meta.height - pixel.y) * meta.resolution + meta.origin[1];
  return { x, y };
}

// Convenience: world point expressed as percentages of image size, handy for
// absolutely-positioning HTML/SVG overlays that scale with the rendered map.
export function worldToPercent(world: WorldPoint, meta: MapMeta = MAP_META): PixelPoint {
  const p = worldToPixel(world, meta);
  return { x: (p.x / meta.width) * 100, y: (p.y / meta.height) * 100 };
}
