import { describe, expect, it } from 'vitest'
import { leesPost } from '../../../lib/extractie/post'

describe('leesPost', () => {
  it('leest een reel met video en omslag', () => {
    const post = leesPost([{
      type: 'Video', caption: 'Pasta!', videoUrl: 'https://cdn/x.mp4', displayUrl: 'https://cdn/x.jpg',
      ownerUsername: 'kokenmetkees', url: 'https://www.instagram.com/reel/abc/',
    }], 'https://www.instagram.com/p/abc/')
    expect(post).toEqual({
      soort: 'video', onderschrift: 'Pasta!', afbeeldingen: ['https://cdn/x.jpg'], videoUrl: 'https://cdn/x.mp4',
      account: '@kokenmetkees', url: 'https://www.instagram.com/reel/abc/',
    })
  })
  it('leest een carrousel met kinderen', () => {
    const post = leesPost([{
      type: 'Sidecar', caption: '', displayUrl: 'https://cdn/1.jpg',
      childPosts: [{ displayUrl: 'https://cdn/1.jpg' }, { displayUrl: 'https://cdn/2.jpg' }],
    }], 'https://www.instagram.com/p/abc/')
    expect(post?.soort).toBe('carrousel')
    expect(post?.afbeeldingen).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg'])
    expect(post?.videoUrl).toBeNull()
    expect(post?.account).toBeNull()
  })
  it('geeft null bij een leeg of foutief antwoord', () => {
    expect(leesPost([], 'https://www.instagram.com/p/abc/')).toBeNull()
    expect(leesPost([{ error: 'not_found' }], 'https://www.instagram.com/p/abc/')).toBeNull()
  })
})
