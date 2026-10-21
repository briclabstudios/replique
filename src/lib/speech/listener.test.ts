import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SceneListener, type MicState } from './listener'

/** Fausse reconnaissance vocale : le test pousse lui-même les résultats. */
class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onaudiostart: (() => void) | null = null
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  private results: { isFinal: boolean; 0: { transcript: string } }[] = []
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start() {
    this.onaudiostart?.()
  }
  abort() {}
  say(transcript: string, isFinal = true) {
    const index = this.results.length
    this.results.push({ isFinal, 0: { transcript } })
    this.onresult?.({ resultIndex: index, results: this.results })
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('SceneListener', () => {
  let states: MicState[]
  let listener: SceneListener

  beforeEach(() => {
    FakeRecognition.instances = []
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition
    states = []
    listener = new SceneListener((s) => states.push(s), () => {})
  })

  afterEach(() => {
    listener.stop()
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  it('ouvre le micro une seule fois pour toute la scène', () => {
    listener.start()
    listener.start()
    expect(FakeRecognition.instances).toHaveLength(1)
    expect(states).toEqual(['starting', 'ready'])
  })

  it('ignore ce qui est entendu avant mon tour', async () => {
    listener.start()
    const mic = FakeRecognition.instances[0]
    // Le partenaire dit exactement ma réplique avant mon tour : cela ne doit pas compter
    mic.say('je ne puis me repentir de rien')
    let done = false
    listener.waitForLine('Je ne puis me repentir de rien', null, new AbortController().signal).then(() => (done = true))
    await settle()
    expect(done).toBe(false)
    mic.say('je ne puis me repentir de rien')
    await settle()
    expect(done).toBe(true)
  })

  it('garde mes premiers mots dits juste au début du tour', async () => {
    listener.start()
    const mic = FakeRecognition.instances[0]
    mic.say('je ne puis', false)
    const progress: number[] = []
    let done = false
    listener
      .waitForLine('Je ne puis me repentir de rien', null, new AbortController().signal, (_, r) => progress.push(r))
      .then(() => (done = true))
    mic.say('je ne puis me repentir de rien', true)
    await settle()
    expect(done).toBe(true)
  })

  it('ignore l’écho de la réplique lue juste avant par la synthèse (téléphone)', async () => {
    listener.start()
    const mic = FakeRecognition.instances[0]
    const previous = 'Hé quoi ! charmante Élise, vous devenez mélancolique ?'
    const transcripts: string[] = []
    let done = false
    listener
      .waitForLine('Non, Valère, je ne puis me repentir', previous, new AbortController().signal, (heard) =>
        transcripts.push(heard),
      )
      .then(() => (done = true))
    // Le haut-parleur finit d'être reconnu après le début de mon tour, en provisoire puis en définitif
    mic.say('charmante Élise vous devenez', false)
    mic.say('hé quoi charmante Élise vous devenez mélancolique')
    await settle()
    expect(transcripts.every((t) => t === '')).toBe(true)
    mic.say('non Valère je ne puis me repentir')
    await settle()
    expect(transcripts.at(-1)).toBe('non Valère je ne puis me repentir')
    expect(done).toBe(true)
  })

  it('relance l’écoute quand le navigateur l’arrête', async () => {
    vi.useFakeTimers()
    listener.start()
    FakeRecognition.instances[0].onend?.()
    vi.advanceTimersByTime(200)
    expect(FakeRecognition.instances).toHaveLength(2)
    vi.useRealTimers()
  })

  it('le bouton Suivant (annulation) termine le tour', async () => {
    listener.start()
    const ctrl = new AbortController()
    let done = false
    listener.waitForLine('Une réplique', null, ctrl.signal).then(() => (done = true))
    ctrl.abort()
    await settle()
    expect(done).toBe(true)
  })
})
