export type FeedImage = {
  id: string;
  url: string; // dataURL JPG
  ordem: number;
  origem: 'upload' | 'instagram';
  criadoEm: number; // timestamp
};
