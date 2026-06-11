import { getUploadURL, serveObject, proxyUpload } from "../lib/storage.js";
import { Request, Response } from "express";

export default class StorageController {
  static async requestUploadUrl() {
    return getUploadURL();
  }

  static async serve(objectId: string, res: Response) {
    const objectPath = "/objects/uploads/" + objectId;
    await serveObject(objectPath, res);
  }

  static async proxyUpload(token: string, req: Request, res: Response) {
    await proxyUpload(token, req, res);
  }
}
