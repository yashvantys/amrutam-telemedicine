import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { issuePrescription } from "./prescription.controller.js";

const router = Router();

router.use(authenticate);
router.post("/", authorize("DOCTOR"), issuePrescription);

export default router;