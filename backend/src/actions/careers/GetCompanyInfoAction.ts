import { Request, Response } from "express";
import CareersController from "../../controllers/CareersController.js";

export class GetCompanyInfoAction {
  static async handle(_req: Request, res: Response) {
    try {
      const result = await CareersController.getCompanyInfo();
      res.json(result);
    } catch {
      res.json({ companyName: "Our Company", logoLetter: "C", primaryHsl: "221 83% 53%" });
    }
  }
}
