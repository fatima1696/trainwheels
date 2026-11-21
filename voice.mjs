// Makes the voiceover: one MP3 per scene in public/voice/ (Scene1.mp3 ... Scene10.mp3).
// Uses Microsoft's free neural voices through the node-edge-tts package (needs internet, no account).
// Run:  npm run voice
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';

const VOICE = 'en-US-AndrewNeural'; // other good ones: en-US-AriaNeural, en-US-GuyNeural, en-GB-RyanNeural

// the narration is read straight from the BEATS list in index.tsx
const src = readFileSync('index.tsx', 'utf8');
const lines = [...src.matchAll(/\{id: '[^']+', sec: \d+, text: '([^']*)'\}/g)].map((m) => m[1]);
if (lines.length === 0) {
  console.error('Could not find the script lines in index.tsx');
  process.exit(1);
}

mkdirSync('public/voice', {recursive: true});
for (let i = 0; i < lines.length; i++) {
  const file = `public/voice/Scene${i + 1}.mp3`;
  console.log(`\nScene ${i + 1}: ${lines[i]}`);
  const res = spawnSync('npx', ['-y', 'node-edge-tts', '--text', `"${lines[i]}"`, '--filepath', file, '--voice', VOICE], {
    stdio: 'inherit',
    shell: true,
  });
  if (res.status !== 0) {
    console.error(`\nCould not make the voice for scene ${i + 1}.`);
    console.error('You can make the files any other way (a text-to-speech website, or your own recording).');
    console.error('Save them as public/voice/Scene1.mp3, Scene2.mp3 ... Scene10.mp3 and the video will pick them up.');
    process.exit(1);
  }
}
console.log('\nDone. Now run: npm run render');
