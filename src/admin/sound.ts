type SafariWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

export function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as SafariWindow).webkitAudioContext
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported by this browser.')
  return new AudioContextConstructor()
}

async function ensureRunning(context: AudioContext) {
  if (context.state === 'closed') throw new Error('The audio context is closed.')
  if (context.state !== 'running') await context.resume()
  if (context.state !== 'running') throw new Error('The browser did not allow audio playback.')
}

function tone(
  context: AudioContext,
  start: number,
  duration: number,
  frequency: number,
  endFrequency: number,
  volume: number,
) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025)
  gain.gain.setValueAtTime(volume, start + duration * 0.55)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect()
    gain.disconnect()
  })
  return oscillator
}

export async function playCafeChime(context: AudioContext) {
  await ensureRunning(context)
  const start = context.currentTime + 0.035
  tone(context, start, 0.36, 659.25, 698.46, 0.13)
  const finalTone = tone(context, start + 0.24, 0.46, 880, 932.33, 0.115)

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('The chime did not finish playing.')),
      1500,
    )
    finalTone.addEventListener(
      'ended',
      () => {
        window.clearTimeout(timeout)
        resolve()
      },
      { once: true },
    )
  })
}

export async function resumeAudioContext(context: AudioContext) {
  await ensureRunning(context)
}
