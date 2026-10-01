// Centre-crops an image file to a square and re-encodes it as a small JPEG.
// Keeps profile / group pictures light (a few tens of KB) and always circle-friendly.
export async function squareResize(file, size = 384, quality = 0.88) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That image could not be read."));
      el.src = url;
    });

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("That image could not be read.");
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white"; // flatten transparent PNGs onto white for JPEG
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Could not process that image.");
    return new File([blob], ["avatar", "jpg"].join("."), { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
