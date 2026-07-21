/* ================= cube net (unwrapped UVs) =================
 * A second UV set that lays the cube's six faces out as one connected net,
 * so a single texture can carry artwork that runs *across* faces instead of
 * repeating the same square six times.
 *
 * The default box UVs give every face its own [0,1] square, which is what the
 * pattern skins (Rocky, Rubix) want. Skins that draw one continuous subject
 * over the whole cube opt into this second set instead, via `texture.channel`
 * — the geometry carries both, so nothing changes for the other skins.
 *
 * Layout (4 columns x 3 rows), chosen to match how the faces actually join:
 *
 *        +---+
 *        |+Y |                 row 2
 *    +---+---+---+---+
 *    |+Z |+X |-Z |-X |         row 1  <- continuous band around the cube
 *    +---+---+---+---+
 *        |-Y |                 row 0
 *        +---+
 *
 * RoundedBoxGeometry inherits BoxGeometry's six material groups, and each
 * face's UVs already span [0,1] over that face *including its rounded bevel*.
 * That makes the remap a plain affine squeeze per group: exact, no distortion,
 * and artwork drawn across a cell boundary flows over the bevel onto the
 * neighbouring face.
 */

import * as THREE from "three";

export const NET_COLS = 4;
export const NET_ROWS = 3;

/** BoxGeometry material index -> [column, row] in the net. Row 0 is the
 *  bottom of the texture (UV v increases upwards). */
const NET_CELL: Record<number, [number, number]> = {
  4: [0, 1], // +Z front — the column the top and bottom faces hang off
  0: [1, 1], // +X right
  5: [2, 1], // -Z back
  1: [3, 1], // -X left
  2: [0, 2], // +Y top
  3: [0, 0], // -Y bottom
};

/** Adds the net layout as a second UV set (`uv1`) alongside the default
 *  per-face UVs, which are left untouched. */
export function applyNetUvs(geo: THREE.BufferGeometry) {
  const uv = geo.attributes.uv;
  if (!uv || !geo.groups.length) return;

  const out = new Float32Array(uv.count * 2);
  for (const g of geo.groups) {
    const cell = NET_CELL[g.materialIndex ?? 0];
    if (!cell) continue;
    const [col, row] = cell;
    const end = g.start + g.count;
    for (let i = g.start; i < end && i < uv.count; i++) {
      out[i * 2] = (col + uv.getX(i)) / NET_COLS;
      out[i * 2 + 1] = (row + uv.getY(i)) / NET_ROWS;
    }
  }
  geo.setAttribute("uv1", new THREE.BufferAttribute(out, 2));
}
