import {
  Bebas_Neue,
  Cormorant_Garamond,
  DM_Sans,
  IBM_Plex_Sans,
  Libre_Baskerville,
  Lora,
  Orbitron,
  Outfit,
  Playfair_Display,
  Rajdhani,
  Source_Sans_3,
  Special_Elite,
} from "next/font/google";

// Theme fonts for the sim wheel only. preload:false — a viewer only ever
// downloads the faces their chosen theme actually renders. (next/font needs
// literal options at each call, hence the repetition.)
const bebas = Bebas_Neue({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--font-bebas" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600", "700"], variable: "--font-cormorant" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-dm-sans" });
const ibmPlex = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--font-ibm-plex" });
const libreBaskerville = Libre_Baskerville({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--font-libre-baskerville" });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-lora" });
const orbitron = Orbitron({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-orbitron" });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-outfit" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-playfair" });
const rajdhani = Rajdhani({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--font-rajdhani" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-source-sans" });
const specialElite = Special_Elite({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--font-special-elite" });

export const simFontVariables = [
  bebas, cormorant, dmSans, ibmPlex, libreBaskerville, lora,
  orbitron, outfit, playfair, rajdhani, sourceSans, specialElite,
]
  .map((f) => f.variable)
  .join(" ");
