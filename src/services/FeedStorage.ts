import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { FeedImage } from '@/types/feed';

const normalizeOrder = (images: FeedImage[]): FeedImage[] =>
  images
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((img, idx) => ({ ...img, ordem: idx }));

export const FeedStorage = {
  load(): FeedImage[] {
    const data = storage.load<FeedImage[]>(STORAGE_KEYS.FEED_IMAGES, []);
    return normalizeOrder(data);
  },
  save(images: FeedImage[]) {
    storage.save(STORAGE_KEYS.FEED_IMAGES, normalizeOrder(images));
  },
  upsert(image: FeedImage) {
    const data = this.load();
    const idx = data.findIndex((i) => i.id === image.id);
    if (idx >= 0) data[idx] = image; else data.push(image);
    this.save(data);
  },
  remove(id: string) {
    const data = this.load().filter((i) => i.id !== id);
    this.save(data);
  },
  reorder(idsInOrder: string[]) {
    const map = new Map(idsInOrder.map((id, ordem) => [id, ordem] as const));
    const data = this.load().map((img) => ({ ...img, ordem: map.get(img.id) ?? img.ordem }));
    this.save(data);
  },
};
