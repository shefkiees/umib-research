import { useEffect, useState } from "react";

export default function TransparentLogo({
  src,
  alt,
  className,
  threshold = 196,
}) {
  const [transparentSrc, setTransparentSrc] = useState(src);

  useEffect(() => {
    let isMounted = true;
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");

      if (!context) {
        if (isMounted) {
          setTransparentSrc(src);
        }
        return;
      }

      context.drawImage(image, 0, 0);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = frame.data;
      const total = pixels.length / 4;

      const getLuminance = (red, green, blue) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      // Aggressive background removal: eliminate all light/neutral pixels.
      for (let index = 0; index < total; index += 1) {
        const offset = index * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const alpha = pixels[offset + 3];

        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        const saturation = maxChannel - minChannel;
        const luminance = getLuminance(red, green, blue);

        // Remove all light neutral pixels (background + halo).
        const isLightNeutral = saturation <= 36 && luminance >= threshold;
        const isVeryBright = luminance > 240;

        if (isLightNeutral || isVeryBright) {
          pixels[offset + 3] = 0;
          continue;
        }

        // Keep only dark/saturated pixels (logo mark) as black.
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
        pixels[offset + 3] = alpha;
      }

      context.putImageData(frame, 0, 0);

      if (isMounted) {
        setTransparentSrc(canvas.toDataURL("image/png"));
      }
    };

    image.onerror = () => {
      if (isMounted) {
        setTransparentSrc(src);
      }
    };

    image.src = src;

    return () => {
      isMounted = false;
    };
  }, [src, threshold]);

  return <img src={transparentSrc} alt={alt} className={className} />;
}