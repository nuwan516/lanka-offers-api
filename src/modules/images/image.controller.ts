import { Request, Response } from 'express';
import { ImageService } from './image.service';

export class ImageController {
  constructor(private service: ImageService = new ImageService()) {}

  public async getImage(req: Request, res: Response): Promise<void> {
    const image = await this.service.getPublishedImage(String(req.params.key ?? ''));
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', image.bytes.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.bytes);
  }
}
