import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "../config/env";

let _elevenlabs: ElevenLabsClient | null = null;
/** Returns the ElevenLabs client, throwing if the API key is absent. */
function getElevenLabs(): ElevenLabsClient {
  if (!_elevenlabs) {
    if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is required for voice features");
    _elevenlabs = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
  }
  return _elevenlabs;
}

/**
 * Strips markdown and tool-status annotations from a string so that only
 * natural-language prose remains for text-to-speech synthesis.
 * @param text - Raw message content, potentially containing markdown.
 * @returns Plain-text string suitable for speech synthesis.
 */
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")          // fenced code blocks
    .replace(/🔧.*?\.\.\.\*\n\n/g, "")        // MCP tool-status messages
    .replace(/\*\*([^*]+)\*\*/g, "$1")         // bold
    .replace(/\*([^*]+)\*/g, "$1")             // italic
    .replace(/`([^`]+)`/g, "$1")               // inline code
    .replace(/#+\s/g, "")                      // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // markdown links
    .trim();
}

/**
 * Converts text to an MPEG audio stream via ElevenLabs TTS.
 * Truncates input to 5000 characters to stay within API limits.
 * The caller is responsible for piping the returned ReadableStream to the HTTP response.
 * @param text - Already-cleaned plain-text content to synthesise.
 * @param voiceId - ElevenLabs voice ID. Defaults to Rachel (21m00Tcm4TlvDq8ikWAM).
 * @returns A ReadableStream of MPEG audio bytes.
 */
export async function textToSpeechStream(
  text: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM"
): Promise<ReadableStream<Uint8Array>> {
  return getElevenLabs().textToSpeech.convert(voiceId, {
    text: text.substring(0, 5000),
    modelId: "eleven_multilingual_v2",
  });
}

/**
 * Returns all available ElevenLabs voices for the configured account.
 * @returns The raw voices response from the ElevenLabs API.
 */
export async function getVoices() {
  return getElevenLabs().voices.getAll();
}

/**
 * Transcribes an audio buffer to text using ElevenLabs Scribe v1.
 * The buffer is expected to contain WebM audio as recorded by the browser.
 * @param audioBuffer - Raw audio bytes collected from the HTTP request body.
 * @returns The transcribed text string, or an empty string if transcription yields nothing.
 */
export async function speechToText(audioBuffer: Buffer): Promise<string> {
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

  const transcription = await getElevenLabs().speechToText.convert({
    file: audioBlob,
    modelId: "scribe_v1",
  });

  const result = transcription as { text?: string };
  return result.text || "";
}
