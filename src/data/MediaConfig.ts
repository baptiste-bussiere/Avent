
// mediaConfig.ts
export type MediaType = 'image' | 'video'

export type BookMediaConfig = {
  type: MediaType
  src: string
}

export const BOOK_MEDIA: Record<string, BookMediaConfig> = {
  '001': { type: 'image', src: 'textures/presents/texture_001.png' },
  '002': { type: 'image', src: 'textures/presents/texture_002.png' },
  '003':{ type: 'image', src: 'textures/presents/texture_003.png' },
  '004': { type: 'image', src: 'textures/presents/texture_004.png' },
  '005': { type: 'image', src: 'textures/presents/texture_005.png' }, 
  '006': { type: 'image', src: 'textures/presents/texture_006.png' },
  '007': { type: 'image', src: 'textures/presents/texture_007.png' },
  '008': { type: 'image', src: 'textures/presents/texture_008.png' },
  '009': { type: 'image', src: 'textures/presents/texture_009.png' },
  '010': { type: 'image', src: 'textures/presents/texture_010.png' },
  '011': { type: 'image', src: 'textures/presents/texture_011.png' },
  '012': { type: 'image', src: 'textures/presents/texture_012.png' },
  '013': { type: 'image', src: 'textures/presents/texture_013.png' },
  '014': { type: 'image', src: 'textures/presents/texture_014.png' },
  '015': { type: 'image', src: 'textures/presents/texture_015.png' },
  '016': { type: 'image', src: 'textures/presents/texture_016.png' },
  '017': { type: 'image', src: 'textures/presents/texture_017.png' },
  '018': { type: 'image', src: 'textures/presents/texture_018.png' },
  '019': { type: 'image', src: 'textures/presents/texture_019.png' },
  '020': { type: 'image', src: 'textures/presents/texture_020.png' },
  '021': { type: 'image', src: 'textures/presents/texture_021.png' },
  '022': { type: 'image', src: 'textures/presents/texture_022.png' },
  '023': { type: 'image', src: 'textures/presents/texture_023.png' },
  '024': { type: 'image', src: 'textures/presents/texture_024.png' },

}
