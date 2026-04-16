import { getUploadURL, serveObject } from "../lib/storage.js";
import { Response } from "express";

export default class StorageController {
  static async requestUploadUrl() {
    return getUploadURL();
  }

  static async serve(objectId: string, res: Response) {
    const objectPath = "/objects/uploads/" + objectId;
    await serveObject(objectPath, res);
  }
}
