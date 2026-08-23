// Loads a Google Font on demand by injecting a <link>, so preset switching
// doesn't require every preset's font to be bundled via next/font upfront.
// Ported from tweakcn's components/theme-script.tsx.
const DEFAULT_WEIGHTS = ["400", "500", "600", "700"]

export function loadGoogleFont(family: string, weights: string[] = DEFAULT_WEIGHTS) {
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(";")}&display=swap`
  if (document.querySelector(`link[href="${href}"]`)) return

  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  document.head.appendChild(link)
}
