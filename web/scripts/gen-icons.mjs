// Generates the PWA icons into public/ using only built-in modules.
// Run: node scripts/gen-icons.mjs   (the PNGs are committed)
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [23, 23, 23]; // #171717, matches --primary
const FG = [250, 250, 250];
const SS = 4;

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, "ascii");
	data.copy(out, 8);
	out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
}

// Shapes are in unit coordinates (0..1) of the icon.
function inRoundedSquare(x, y, r) {
	if (r === 0) return true;
	const cx = Math.min(Math.max(x, r), 1 - r);
	const cy = Math.min(Math.max(y, r), 1 - r);
	return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inLetterI(x, y, scale) {
	// Capital I with slab serifs, centred, scaled about the centre.
	const u = (v) => 0.5 + (v - 0.5) / scale;
	const px = u(x);
	const py = u(y);
	const stem = px >= 0.44 && px <= 0.56 && py >= 0.26 && py <= 0.74;
	const top = px >= 0.34 && px <= 0.66 && py >= 0.26 && py <= 0.33;
	const bottom = px >= 0.34 && px <= 0.66 && py >= 0.67 && py <= 0.74;
	return stem || top || bottom;
}

function render(size, { radius, letterScale }) {
	const raw = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			let bg = 0;
			let fg = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const ux = (x + (sx + 0.5) / SS) / size;
					const uy = (y + (sy + 0.5) / SS) / size;
					if (!inRoundedSquare(ux, uy, radius)) continue;
					bg++;
					if (inLetterI(ux, uy, letterScale)) fg++;
				}
			}
			const total = SS * SS;
			const o = y * (size * 4 + 1) + 1 + x * 4;
			const covered = bg || 1;
			for (let i = 0; i < 3; i++) {
				raw[o + i] = Math.round((BG[i] * (bg - fg) + FG[i] * fg) / covered);
			}
			raw[o + 3] = Math.round((255 * bg) / total);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

const out = new URL("../public/", import.meta.url);
mkdirSync(out, { recursive: true });
const icons = [
	["icon-192.png", 192, { radius: 0.2, letterScale: 1 }],
	["icon-512.png", 512, { radius: 0.2, letterScale: 1 }],
	// Maskable: full bleed, letter inside the central 80% safe zone.
	["icon-maskable-512.png", 512, { radius: 0, letterScale: 0.8 }],
	// iOS applies its own rounding, so the apple icon is full bleed too.
	["apple-touch-icon.png", 180, { radius: 0, letterScale: 0.9 }],
];
for (const [name, size, opts] of icons) {
	writeFileSync(new URL(name, out), render(size, opts));
	console.log(`wrote public/${name}`);
}
