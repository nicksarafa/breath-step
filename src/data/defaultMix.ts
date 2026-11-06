/**
 * The curated soundtrack: one song per cycle. Used until someone picks their
 * own on the Music page. Track IDs are public Spotify metadata, safe to publish.
 */
import type { Mix } from '../store'

export const DEFAULT_MIX: Mix = {
  c1: [{ id: '0WuBIVeebCtLQMaP13gdTN', uri: 'spotify:track:0WuBIVeebCtLQMaP13gdTN', name: "Stones Start Spinning", artists: "David Darling", durationMs: 255739, image: 'https://i.scdn.co/image/ab67616d00001e024a2809caab87dc4464730472' }],
  c2: [{ id: '7FhS0WDdcyWPQYzfagOp6n', uri: 'spotify:track:7FhS0WDdcyWPQYzfagOp6n', name: "Circles", artists: "Niko Schwind, Felix Raphael", durationMs: 397906, image: 'https://i.scdn.co/image/ab67616d00001e02191af10039bf1f5ed5b5b13a' }],
  c3: [{ id: '7ANyJisklRfxixNF7EZDrt', uri: 'spotify:track:7ANyJisklRfxixNF7EZDrt', name: "Ain’t Nobody (Loves Me Better) - Acoustic Version", artists: "Jasmine Thompson", durationMs: 178355, image: 'https://i.scdn.co/image/ab67616d00001e02bc8f499b70dea02b66c8deba' }],
  c4: [{ id: '3dQl1duLSpgetTzxIOZrb6', uri: 'spotify:track:3dQl1duLSpgetTzxIOZrb6', name: "All Your Love", artists: "Dustin Tebbutt", durationMs: 225472, image: 'https://i.scdn.co/image/ab67616d00001e02e16ff38c1c0e79aaddfdc66c' }],
  c5: [{ id: '4fWFTxsJf5ZwvokJwl1BjI', uri: 'spotify:track:4fWFTxsJf5ZwvokJwl1BjI', name: "Silence (feat. Kollmorgen) - Mollono.Bass Remix", artists: "Dole & Kom, Kollmorgen", durationMs: 448423, image: 'https://i.scdn.co/image/ab67616d00001e0219e800f9d8f0a1e4ce583e14' }],
  c6: [{ id: '1DnRZoHSWwXY83hdhApS2W', uri: 'spotify:track:1DnRZoHSWwXY83hdhApS2W', name: "City Dweller", artists: "Jaques", durationMs: 229830, image: 'https://i.scdn.co/image/ab67616d00001e02f1d5c1b428060610620683f1' }],
  c7: [{ id: '66RMkzVBVjI3MlOiQ4v4gL', uri: 'spotify:track:66RMkzVBVjI3MlOiQ4v4gL', name: "Running In A Dream", artists: "Nils Hoffmann, Kasbo, Vancouver Sleep Clinic", durationMs: 269221, image: 'https://i.scdn.co/image/ab67616d00001e0249cbb6ca8266013a16847756' }],
  c8: [{ id: '1oh9fth6BvkDM5mGJxfNIj', uri: 'spotify:track:1oh9fth6BvkDM5mGJxfNIj', name: "A Promise", artists: "Meernaa", durationMs: 177822, image: 'https://i.scdn.co/image/ab67616d00001e025871489789a2bf0701db85b1' }],
  c9: [{ id: '3VrcaX1j7kSZpcE55vigoZ', uri: 'spotify:track:3VrcaX1j7kSZpcE55vigoZ', name: "Alabora - Foxall Pale Blue Remix", artists: "Beyhude, Foxall", durationMs: 470335, image: 'https://i.scdn.co/image/ab67616d00001e028a0c3b6e3ad55f9fa4852826' }],
}
