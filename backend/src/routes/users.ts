import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListUsersAction } from "../actions/users/ListUsersAction.js";
import { ListCoworkersAction } from "../actions/users/ListCoworkersAction.js";
import { CreateUserAction } from "../actions/users/CreateUserAction.js";
import { GetUserAction } from "../actions/users/GetUserAction.js";
import { UpdateUserAction } from "../actions/users/UpdateUserAction.js";
import { UpdateProfilePhotoAction } from "../actions/users/UpdateProfilePhotoAction.js";
import { UpdateHrProfileAction } from "../actions/users/UpdateHrProfileAction.js";
import { DeleteUserAction } from "../actions/users/DeleteUserAction.js";
import { GetDocumentsAction } from "../actions/users/GetDocumentsAction.js";
import { CreateDocumentAction } from "../actions/users/CreateDocumentAction.js";
import { DeleteDocumentAction } from "../actions/users/DeleteDocumentAction.js";
import { GetBeneficiariesAction } from "../actions/users/GetBeneficiariesAction.js";
import { CreateBeneficiaryAction } from "../actions/users/CreateBeneficiaryAction.js";
import { UpdateBeneficiaryAction } from "../actions/users/UpdateBeneficiaryAction.js";
import { DeleteBeneficiaryAction } from "../actions/users/DeleteBeneficiaryAction.js";
import { GetWorkExperienceAction } from "../actions/users/GetWorkExperienceAction.js";
import { CreateWorkExperienceAction } from "../actions/users/CreateWorkExperienceAction.js";
import { UpdateWorkExperienceAction } from "../actions/users/UpdateWorkExperienceAction.js";
import { DeleteWorkExperienceAction } from "../actions/users/DeleteWorkExperienceAction.js";
import { GetEducationAction } from "../actions/users/GetEducationAction.js";
import { CreateEducationAction } from "../actions/users/CreateEducationAction.js";
import { UpdateEducationAction } from "../actions/users/UpdateEducationAction.js";
import { DeleteEducationAction } from "../actions/users/DeleteEducationAction.js";
import { GetReferencesAction } from "../actions/users/GetReferencesAction.js";
import { UpdateReferencesAction } from "../actions/users/UpdateReferencesAction.js";
import { BulkImportAction } from "../actions/users/BulkImportAction.js";

const router = Router();

router.get("/users", requireAuth, requireRole("admin", "manager"), ListUsersAction.handle);
router.get("/users/coworkers", requireAuth, ListCoworkersAction.handle);
router.post("/users", requireAuth, requireRole("admin"), CreateUserAction.handle);
router.get("/users/:id", requireAuth, GetUserAction.handle);
router.put("/users/:id", requireAuth, requireRole("admin"), UpdateUserAction.handle);
router.put("/users/:id/profile-photo", requireAuth, UpdateProfilePhotoAction.handle);
router.put("/users/:id/hr-profile", requireAuth, UpdateHrProfileAction.handle);
router.delete("/users/:id", requireAuth, requireRole("admin"), DeleteUserAction.handle);

router.get("/users/:id/documents", requireAuth, GetDocumentsAction.handle);
router.post("/users/:id/documents", requireAuth, CreateDocumentAction.handle);
router.delete("/users/:id/documents/:docId", requireAuth, DeleteDocumentAction.handle);

router.get("/users/:id/beneficiaries", requireAuth, GetBeneficiariesAction.handle);
router.post("/users/:id/beneficiaries", requireAuth, CreateBeneficiaryAction.handle);
router.put("/users/:id/beneficiaries/:rowId", requireAuth, UpdateBeneficiaryAction.handle);
router.delete("/users/:id/beneficiaries/:rowId", requireAuth, DeleteBeneficiaryAction.handle);

router.get("/users/:id/work-experience", requireAuth, GetWorkExperienceAction.handle);
router.post("/users/:id/work-experience", requireAuth, CreateWorkExperienceAction.handle);
router.put("/users/:id/work-experience/:rowId", requireAuth, UpdateWorkExperienceAction.handle);
router.delete("/users/:id/work-experience/:rowId", requireAuth, DeleteWorkExperienceAction.handle);

router.get("/users/:id/education", requireAuth, GetEducationAction.handle);
router.post("/users/:id/education", requireAuth, CreateEducationAction.handle);
router.put("/users/:id/education/:rowId", requireAuth, UpdateEducationAction.handle);
router.delete("/users/:id/education/:rowId", requireAuth, DeleteEducationAction.handle);

router.get("/users/:id/references", requireAuth, GetReferencesAction.handle);
router.put("/users/:id/references", requireAuth, UpdateReferencesAction.handle);

router.post("/users/bulk-import", requireAuth, requireRole("admin", "super_admin"), BulkImportAction.handle);

export default router;
