import { describe, expect, it } from 'vitest'
import { parseUserAgent } from './analytics'

describe('parseUserAgent', () => {
  it('reconnaît un téléphone Android sous Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
    expect(parseUserAgent(ua)).toEqual({ device: 'mobile', os: 'Android', browser: 'Chrome' })
  })

  it('reconnaît une tablette Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    expect(parseUserAgent(ua).device).toBe('tablet')
  })

  it('reconnaît un iPhone sous Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    expect(parseUserAgent(ua)).toEqual({ device: 'mobile', os: 'iOS', browser: 'Safari' })
  })

  it('reconnaît Edge sous Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'
    expect(parseUserAgent(ua)).toEqual({ device: 'desktop', os: 'Windows', browser: 'Edge' })
  })
})
