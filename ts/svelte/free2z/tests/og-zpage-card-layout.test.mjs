import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

let server, buildZpageCardSvg, chooseCardLayout;
before(async () => {
  server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ buildZpageCardSvg, chooseCardLayout } = await server.ssrLoadModule(
    "/src/lib/server/og-zpage-card.ts",
  ));
});
after(async () => {
  await server?.close();
});

// A solid magenta cover: every frame pixel that shows it is unambiguous.
async function cover(width, height) {
  const png = await sharp({
    create: { width, height, channels: 3, background: "#ff00ff" },
  })
    .png()
    .toBuffer();
  return {
    href: `data:image/png;base64,${png.toString("base64")}`,
    dimensions: { width, height },
  };
}

const article = {
  title: "Shielded by default: what the next upgrade means for creators",
  description: "Private payments and direct support for publishers.",
  category: "Privacy",
  creator: { username: "zooko" },
};

const render = (svg) =>
  new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().pixels;
const isCover = (pixels, x, y) => {
  const i = (y * 1200 + x) * 4;
  return pixels[i] > 230 && pixels[i + 1] < 40 && pixels[i + 2] > 230;
};

test("the layout follows the cover's real aspect ratio", () => {
  const of = (width, height) =>
    chooseCardLayout({ href: "x", dimensions: { width, height } });
  assert.equal(chooseCardLayout(null), "text");
  assert.equal(of(1600, 900), "landscape");
  assert.equal(of(3000, 1000), "landscape");
  assert.equal(of(1000, 1000), "square");
  assert.equal(of(900, 1000), "square");
  assert.equal(of(800, 1200), "portrait");
  assert.equal(of(450, 800), "portrait");
  // Unsized covers are still shown, in the ratio-agnostic square frame.
  assert.equal(chooseCardLayout({ href: "x" }), "square");
});

for (const [name, width, height, side] of [
  ["landscape", 1600, 900, "right"],
  ["banner", 3000, 1000, "right"],
  ["square", 1000, 1000, "right"],
  ["portrait", 600, 900, "left"],
  ["tall portrait", 450, 800, "left"],
]) {
  test(`${name} cover renders whole and uncropped on the ${side}`, async () => {
    const svg = buildZpageCardSvg(article, await cover(width, height));
    // The data URI is embedded exactly once, however many times it is drawn.
    assert.equal(svg.split("data:image/png").length - 1, 1);
    const art = /<image id="art"[^>]*width="([\d.]+)" height="([\d.]+)"/.exec(
      svg,
    );
    const plate = /<use href="#art" x="([\d.]+)" y="([\d.]+)"\/>/.exec(svg);
    assert.ok(art && plate, "cover plate");
    const [w, h] = art.slice(1).map(Number);
    const [x, y] = plate.slice(1).map(Number);
    assert.ok(Math.abs(w / h - width / height) < 0.01, "plate keeps the ratio");
    assert.ok(x >= 0 && y >= 0 && x + w <= 1200.01 && y + h <= 630.01);
    assert.ok(side === "left" ? x + w / 2 < 600 : x + w / 2 > 600);
    const pixels = render(svg);
    // Sample the whole plate, so any regression that hides part of the cover
    // (pad, seam or clip geometry, or a Resvg quirk) fails here.
    // The 28px seam shading at the panel's text-side edge is excluded.
    for (let sy = Math.ceil(y) + 12; sy < y + h - 12; sy += 16) {
      for (let sx = Math.ceil(x) + 32; sx < x + w - 32; sx += 16) {
        assert.ok(isCover(pixels, sx, sy), `cover missing at ${sx},${sy}`);
      }
    }
  });
}

test("a coverless card renders the text layout", () => {
  const svg = buildZpageCardSvg(article, null);
  assert.doesNotMatch(svg, /<image\b/);
  assert.ok(render(svg).length);
});
